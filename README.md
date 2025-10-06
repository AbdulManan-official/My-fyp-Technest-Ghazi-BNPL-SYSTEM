# TechNest BNPL System (Buy Now Pay Later App)


## Overview
TechNest BNPL System is a mobile application developed using React Native for the front-end and Firebase for backend services. The app allows users to purchase products with flexible Buy Now Pay Later (BNPL) plans and provides real-time order tracking, notifications, and installment management. The system also includes an admin panel for product management, user verification, and analytics.

---

## Features

### Admin Functionalities
- User Management
  - Verify users who apply for account verification
  - View user details and manage verification status
  - Chat with users for support or queries
- Product Management
  - Create, edit, and delete products
  - Upload product images (max 3) and 1 optional video
  - Manage product categories (add, update, delete)
- BNPL Plan Management
  - Create, edit, and delete BNPL plans
  - Assign plans to products
- Order Management
  - View all orders and shipment status
  - Confirm installment payments
- Dashboard
  - Overview of total products, orders, users, and active BNPL plans
  - Track delivery schedules and payment timelines
- Notifications
  - Receive real-time notifications for verification requests, pending payments, and order updates
- Payment Integration
  - Stripe integration for secure payments and installments

### User Functionalities
- Authentication & Profile
  - Signup and login functionality
  - Update profile details
  - Apply for account verification
- Product Interaction
  - Browse, search, and view product details
  - Select BNPL plans for products
- BNPL & Payments
  - View BNPL plans and confirm installment payments
  - Track payment schedules
- Orders
  - Track order status: shipped, delivered, pending
- Chat
  - Chat with admin for support or queries
- Notifications
  - Receive notifications for verification status, order updates, and payment reminders

---

## Technologies and Packages Used

### Frontend
- React Native – Cross-platform mobile development
- react-native-paper / react-native-elements – UI components
- react-native-vector-icons – Icons support
- @react-navigation/native – Navigation between screens
- @react-navigation/stack / bottom-tabs – Stack and tab navigation

### Backend & Database
- Firebase Authentication – User login/signup
- Firestore Database – Real-time product, order, and BNPL data
- Firebase Storage – Store product images and videos
- Firebase Realtime Database – Chat functionality between admin and users
- Push Notifications – Real-time notifications for users and admin

### Media & Camera
- expo-image-picker – Pick images and videos from device library
- expo-camera – Capture images/videos using device camera

### Payment & Reports
- stripe-react-native – Stripe payment integration for secure transactions
- react-native-html-to-pdf – Generate PDF reports for admin dashboard

### Other Utilities
- react-native-modal – For modals like product upload and plan selection

---

## Setup and Installation

1. Clone the repository
git clone url_of_repo
cd TechNest-BNPL

markdown
Copy code

2. Install dependencies
npm install

markdown
Copy code

3. Configure Firebase
- Create a Firebase project
- Replace your `firebaseConfig` in the project with your Firebase project credentials

4. Run the app (Expo)
npx expo start

yaml
Copy code
- Scan the QR code on your device or use an emulator

---

## Usage
- Admin can manage products, BNPL plans, users, orders, and view dashboard analytics
- Users can browse products, select BNPL plans, chat with admin, and track orders
- Both admin and users receive real-time notifications for relevant updates

---

## Future Enhancements
- Implement in-app notifications with detailed tracking
- Add analytics charts in admin dashboard
- Support multiple payment gateways
- Add multilingual support

---


---

## Author
Abdul Manan  
Location: Pakistan  
Email: abdullmanan7777@gmail.com  
GitHub: [https://github.com/AbdulManan-official](https://github.com/AbdulManan-official)  
LinkedIn: [[https://www.linkedin.com/in/abdul-manan-a96351254/](https://www.linkedin.com/in/abdul-manan-a9](https://www.linkedin.com/in/abdul-manan-a96351254/)

## Folder Structure
