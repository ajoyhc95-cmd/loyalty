import { NextRequest, NextResponse } from "next/server";
import { hashPassword, type Role } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/db";

const signupRoles: Role[] = ["agent", "merchant", "customer"];

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Complete the signup form.");
  const data = body as Record<string, unknown>;
  const role = data.role;
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  const password = typeof data.password === "string" ? data.password : "";
  const mobile = typeof data.mobile === "string" ? data.mobile.trim() : "";
  if (!signupRoles.includes(role as Role)) return jsonError("Choose Customer, Merchant, or Agent.");
  if (name.length < 2 || name.length > 100 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError("Enter a valid name (2–100 characters) and email address.");
  }
  if (password.length < 12 || password.length > 128) return jsonError("Password must contain between 12 and 128 characters.");
  if (mobile.length > 30) return jsonError("Mobile number is too long.");
  if (typeof data.fatherName === "string" && data.fatherName.length > 100) return jsonError("Father's name is too long.");
  if (typeof data.address === "string" && data.address.length > 500) return jsonError("Address is too long.");
  if (typeof data.dateOfBirth === "string" && data.dateOfBirth) {
    const parsedDate = new Date(`${data.dateOfBirth}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dateOfBirth) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== data.dateOfBirth) {
      return jsonError("Enter a valid date of birth.");
    }
  }
  if (role === "customer" && (
    typeof data.examNumber !== "string" || !data.examNumber.trim() || data.examNumber.length > 80 || data.marks === undefined
  )) return jsonError("Enter your exam number and marks.");
  if ((role === "agent" || role === "merchant") && (
    typeof data.approvalNumber !== "string" || !data.approvalNumber.trim() || data.approvalNumber.length > 80
  )) return jsonError("Enter your approval number.");
  if (role === "merchant" && (typeof data.shopName !== "string" || !data.shopName.trim() || data.shopName.length > 120)) {
    return jsonError("Enter a shop name of up to 120 characters.");
  }
  if (role === "customer" && (
    (typeof data.marks !== "string" && typeof data.marks !== "number") ||
    String(data.marks).trim() === "" ||
    !Number.isFinite(Number(data.marks)) ||
    Number(data.marks) < 0 ||
    Number(data.marks) > 9999.99
  )) {
    return jsonError("Enter marks between 0 and 9,999.99.");
  }
  const photoDataUrl = typeof data.photoDataUrl === "string" ? data.photoDataUrl : null;
  if (photoDataUrl && (
    photoDataUrl.length > 700_000 ||
    !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(photoDataUrl)
  )) return jsonError("Use a valid JPG, PNG, or WebP photo no larger than 512 KB.");

  try {
    const result = await db.query(
      `INSERT INTO users
         (name, father_name, address, date_of_birth, email, mobile, role, password_hash,
          exam_number, marks, approval_number, shop_name, photo_url, generate_id_card)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        name,
        typeof data.fatherName === "string" ? data.fatherName.trim() : "",
        typeof data.address === "string" ? data.address.trim() : "",
        typeof data.dateOfBirth === "string" && data.dateOfBirth ? data.dateOfBirth : null,
        email,
        mobile,
        role,
        hashPassword(password),
        role === "customer" ? String(data.examNumber).trim() : null,
        role === "customer" ? Number(data.marks) : null,
        role !== "customer" ? String(data.approvalNumber).trim() : null,
        role === "merchant" && typeof data.shopName === "string" ? data.shopName.trim() : null,
        photoDataUrl,
        data.generateIdCard !== "false",
      ],
    );
    return NextResponse.json({ ok: true, requestId: result.rows[0].id }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return jsonError("An account already uses this email address.", 409);
    }
    console.error("Signup request failed:", error);
    return jsonError("Could not submit your request. Please try again.", 500);
  }
}
