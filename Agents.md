# Loyality points manager

# Business requirments
- Build a web application, which can manage the accounts of loyalty points, where users can transfer their points to another user account using the the barcode or account number. can see his own balance points. 

# Requirment details.
- The application will have four types of users:
- Admin (me, the app owner), 
- Agent (my staff), 
- Merchant (shopkeepers), 
- Customer (consumers). 

# Accounts Details.
- There will be a total of five types of accounts will be there on which all the points transaction will happen.
- Each user will have a unique user_id, unique barcode/QR and unique account number.
- The points transaction will happen using the barcode or user_id or account number.
- 1. Admin's Primary Account: Points will be issued to this account first. After that, it will be transferred to other accounts when required.
- Primary Account Alert: Trigger an alert signal in the admins dashboard page, if the total number of points issued in the primary account exceeds the sum of points across all other accounts.
- 2. Admin's Secondary Account: Points deducted as commission and service charges according to the rules will be deposited into this account.
- 3. Agent's Account: The agent's commission points will be deposited into this account.
- 4. Merchant's Account: The admin will add points to the merchant's account equal to the amount of money (in Rupees) the merchant deposits into the admin's primary account.
- 5. Customer's Account: Discounts given by the merchant will be deposited into this account. Additionally, agents will add points from product barcodes into this account.
- The customer can send points from his own account to other merchants in the network using their QR codes or user_id or account number.

# User Roles
- 1. Admin: Full control. Has the power to manage all Agent (staff), Merchant (shopkeeper), and Customer data, points, commissions, staff, shop listings, and user ID creations approvals.
- 2. Merchant: can logs in to the application and scan the customer's barcode and transfer points from his own accounts to the customer's barcode (account). can Views his  own account balance points , mini statement, and transaction history,
his shop profile.
- 3. Customer: can log into the application using his user ID and can scan the agent's or merchant's barcode (account) to send his point to them . can views his own account point balance, mini statement, transaction history, and the list of partner, list of agents and list of shops.
- 4. Agent: can log into the application using his own user ID and can scan the product QR code , which will be there in the product packet .and can transfer those points to the customer's barcode (account). can Views his own account point balance, mini statement, and transaction history.

# Distribution of product QR code Points by the Agent

- Inside the product packets, there will be a discount coupon (QR/barcode) containing points.
- Admin can generate the QR code which contain the points , agent can redeeem those points by scanning those QR codes.
- The customer will take the QR/barcode to an agent.
- The agent will log into the application using his user ID and can scan the product QR/barcodes and points will added to his acccount.
- Agent can now send the points to customer.
- Once customer receive the point , a pop-up will open, which contains the list of multiple choice questions anwsers.

- If the customer answers 100% correctly: 95% of the total scanned points will be credited to the customer's account, and 5% to the agent's account.
- If the customer answers 75% correctly: 75% will be credited to the customer's account, 10% to the admin's secondary account, and 15% to the agent's account.
- If the customer answers 50% correctly: 50% will be credited to the customer's account, 30% to the admin's secondary account, and 20% to the agent's account.
- If the customer answers 25% correctly: 25% will be credited to the customer's account, 50% to the admin's secondary account, and 25% to the agent's account.
- If the customer answers 0% correctly: 0% will be credited to the customer's account, 70% to the admin's secondary account, and 30% to the agent's account.
- Customers can send their points to an agent using their scanner to buy goods in exchange for points.
 keep these % configurable in a Plan table.


# signup or create a new user id
- Do you want to generate an ID card? Yes / No , radio buttons
- If Yes is selected, application will provide the below dropdown and input textboxes.
Dropdown - User type (options : Customer, Merchant, Agent)
Input textboxes with the lebels as 
-Name
-Father's Name
-Address
-Date of Birth
-userid
- Mobile Number
- Email ID

- If Customer is being selected: he needs to enter their exam number and marks obtained, then press the submit button. Their user ID will be generated after Admin approval.
- If Agent is being selected: he needs to enter an approval number and press submit. his user ID will be generated after Admin approval.
- If Merchant is being selected: He needs to enter an approval number press submit. his user ID will be generated after Admin approval.
- Once user generated, they can print their ID card from anywhere, ID card will contain name, userid, bar code, user's photo.

# Understanding the Project Through an Example
Suppose a person named Sohan is my customer. He buys some products from our company and gets QR/barcodes worth 10, 15, and 25 points. He goes to Mohan who is an agent in our network. Agent Mohan opens logs into the application using his own user ID and then he first scans customer Sohan's barcode using the scanner available in the application. Then, upon scanning the three QR/barcodes, the total comes to 50 points. As soon as Mohan starts the process of transferring these points to Sohan's ID, a pop-up opens on the agent's ID account containing four objective-type questions and answers.
If Sohan answers 75% of them correctly, according to the rules, 75% of 50 (37.5 points) will be credited to Sohan's account. 15% of 50 (7.5 points) will be credited to Agent Mohan's account, and 10% of 50 (5 points) will be credited to the Admin's secondary account.
Now, customer Sohan goes to Rohana merchant in our network. There, he buys goods worth ₹600, on which the merchant offers a ₹30 discount. Instead of giving ₹30 in cash, the merchant transfers 30 points into Sohan's barcode from his own 1,000-point balance (which he had previously gotten issued by the Admin). 
Before that, customer Sohan sends his account's 37.5 points to the merchant's account. This is because when a merchant sends points to a customer's QR/barcode, any pre-existing points in the customer's account will automatically transfer to the Admin's secondary account. Therefore, customer Sohan first transfers his 37.5 points to the merchant's account, and then the merchant sends 30 points to the customer's QR/barcode. In this way, the customer pays the remaining ₹562.5 (600 - 37.5) to the merchant through any other payment method.
The customer, agent, and merchant will carry out this entire process using their Android mobile phones. This cycle will continue, and points will keep circulating in the accounts according to the rules.

# Technical details 
next.js 
vercel 

# Database Table details 
- Table name : User
Column name : id, Name, Father_Name, Address, Date_of_Birth, user_id, Mobile Number, Email_ID, user_type
- Account: Account
Column name: id, account_id, points
- Table name : Transaction 
Column name: id, transaction_id, From_user, To_user, transaction_date, points_transfered, points_balance
- Table name: questions 
Coulmn name : question, correct_answer, list_of_correct_wrong_answers.
- Table name : QR_code
column name: user_id, QR_code
- Table name: Shop 
column name : id, shop_name, shop_owner 
- Table name : Product
column name : id, QR_code, points, points_redeemed, points_added_date, points_redeemed_date
- Table name : Plan 
column : correct_answers_percentage, admins_commission_percentage, agents_commission_percentage

