md
# TechNest BNPL System (Buy Now Pay Later App)

## Overview

TechNest BNPL System is a mobile application developed using React Native for the front-end and Firebase for backend services. The app allows users to purchase products with flexible Buy Now Pay Later (BNPL) plans and provides real-time order tracking, notifications, and installment management. The system also includes an admin panel for product management, user verification, and analytics.

---

## Key Features & Benefits

*   **Buy Now Pay Later (BNPL):** Offers flexible payment plans for users, increasing accessibility to products.
*   **Real-time Order Tracking:** Provides users with up-to-date information on their order status.
*   **Admin Dashboard:** Allows administrators to manage products, users, and system settings.
*   **Stripe Payment Integration:** Secure and reliable payment processing using Stripe.
*   **Real-time Chat:** Integrated chat functionality for customer support and communication.
*   **User Authentication & Verification:** Secure user accounts with Firebase authentication.
*   **Push Notifications:** Keeps users informed about order updates, promotions, and payment reminders.

---

## Prerequisites & Dependencies

Before you begin, ensure you have met the following requirements:

*   **Node.js:** (v16 or higher recommended) - [https://nodejs.org/](https://nodejs.org/)
*   **npm** or **Yarn:** Package manager.  (npm comes with Node.js)
*   **React Native CLI:** For building and running the app.
*   **Android Studio** (for Android development) - [https://developer.android.com/studio](https://developer.android.com/studio)
*   **Xcode** (for iOS development) - Requires a macOS environment
*   **Firebase Account:** For backend services (Authentication, Database, Storage). [https://firebase.google.com/](https://firebase.google.com/)
*   **Stripe Account:** For payment processing. [https://stripe.com/](https://stripe.com/)
*   **Expo CLI:** Recommended for easier development and deployment. `npm install -g expo-cli`

**Dependencies:**

```json
// package.json example (check your project's package.json for exact versions)
{
  "dependencies": {
    "@react-native-async-storage/async-storage": "*",
    "@react-native-community/masked-view": "0.1.10",
    "@react-native-picker/picker": "^2.4.8",
    "@react-navigation/native": "^6.0.0",
    "@react-navigation/stack": "^6.0.0",
    "@stripe/stripe-react-native": "*",
    "expo": "^48.0.0",
    "expo-linear-gradient": "~12.0.1",
    "expo-status-bar": "~1.4.4",
    "firebase": "*",
    "react": "18.2.0",
    "react-native": "0.71.8",
    "react-native-gesture-handler": "~2.9.0",
    "react-native-paper": "^5.1.4",
    "react-native-reanimated": "~2.14.4",
    "react-native-safe-area-context": "4.5.0",
    "react-native-screens": "~3.20.0"
  },
  "devDependencies": {
    "@babel/core": "^7.20.0"
  }
}
```

---

## Installation & Setup Instructions

1.  **Clone the Repository:**

    ```bash
    git clone https://github.com/AbdulManan-official/My-fyp-Technest-Ghazi-BNPL-SYSTEM.git
    cd My-fyp-Technest-Ghazi-BNPL-SYSTEM
    ```

2.  **Navigate to the `fyp` directory:**

    ```bash
    cd fyp
    ```

3.  **Install Dependencies:**

    Using npm:

    ```bash
    npm install
    ```

    Using Yarn:

    ```bash
    yarn install
    ```

4.  **Configure Firebase:**

    *   Create a new project in the [Firebase Console](https://console.firebase.google.com/).
    *   Add a new web app to your Firebase project.
    *   Copy the Firebase configuration object.
    *   Create a `firebaseConfig.js` file in the root directory of the `fyp` folder.
    *   Paste the Firebase configuration object into `firebaseConfig.js`.

    ```javascript
    // firebaseConfig.js
    import { initializeApp } from 'firebase/app';
    import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
    import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
    import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

    const firebaseConfig = {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_AUTH_DOMAIN",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_STORAGE_BUCKET",
      messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
      appId: "YOUR_APP_ID",
      measurementId: "YOUR_MEASUREMENT_ID"
    };

    const app = initializeApp(firebaseConfig);

    const db = getFirestore(app);
    const auth = getAuth(app);
    const storage = getStorage(app);

    export { app, db, auth, storage, collection, getDocs, addDoc, deleteDoc, doc, updateDoc, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, ref, uploadBytes, getDownloadURL };
    ```

5.  **Configure Stripe:**

    *   Create a Stripe account and obtain your Publishable Key and Secret Key from the [Stripe Dashboard](https://dashboard.stripe.com/).
    *   In the `fyp/Components/StripeWrapper.js` file, replace `YOUR_STRIPE_PUBLISHABLE_KEY` with your actual Stripe Publishable Key.

    ```javascript
    // fyp/Components/StripeWrapper.js
    const STRIPE_PUBLISHABLE_KEY = 'YOUR_STRIPE_PUBLISHABLE_KEY'; // Replace with your actual key

    // ... rest of the component
    ```

6.  **Run the Application:**

    Using Expo:

    ```bash
    npx expo start
    ```

    This will open the Expo development environment in your browser. You can then run the app on a physical device or simulator.

---

## Usage Examples & API Documentation (if applicable)

### Sample Code Snippets

#### Firebase Authentication (Login)

```javascript
import { auth, signInWithEmailAndPassword } from '../firebaseConfig';

const handleLogin = async (email, password) => {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    console.log('User logged in successfully!');
  } catch (error) {
    console.error('Login error:', error.message);
  }
};
```

#### Adding data to Firebase Firestore

```javascript
import { db, collection, addDoc } from '../firebaseConfig';

const addProduct = async (productData) => {
  try {
    const docRef = await addDoc(collection(db, "products"), productData);
    console.log("Document written with ID: ", docRef.id);
  } catch (e) {
    console.error("Error adding document: ", e);
  }
};
```

#### Stripe Payment Implementation

```javascript
// Example (refer to Stripe documentation for comprehensive details)
import { useStripe } from '@stripe/stripe-react-native';

const PaymentComponent = () => {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const initializePayment = async () => {
    // Fetch payment intent client secret from your backend
    const clientSecret = await fetchPaymentIntent(); // Replace with your API call

    const { error } = await initPaymentSheet({
      clientSecret: clientSecret,
    });

    if (error) {
      console.error(error);
    }
  };

  const handlePayment = async () => {
    const { error } = await presentPaymentSheet();

    if (error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.log('Payment successful!');
    }
  };

  return (
    <Button title="Pay" onPress={handlePayment} />
  );
};
```

---

## Configuration Options

*   **Firebase Configuration:** The `firebaseConfig` object in `firebaseConfig.js` contains all necessary Firebase project settings.
*   **Stripe Publishable Key:** Set in `fyp/Components/StripeWrapper.js`. Remember to use your *publishable* key here, not your secret key.
*   **Environment Variables:** You can use `.env` files to manage sensitive information such as API keys and database credentials. Install `react-native-dotenv` using `npm install react-native-dotenv --save` or `yarn add react-native-dotenv` and configure your `.env` file accordingly. Remember to update your `.gitignore` file to prevent committing the `.env` file.

---

## Contributing Guidelines

We welcome contributions to the TechNest BNPL System project! To contribute, please follow these guidelines:

1.  **Fork the repository** on GitHub.
2.  **Create a new branch** for your feature or bug fix.
3.  **Make your changes** and commit them with descriptive commit messages.
4.  **Test your changes** thoroughly.
5.  **Submit a pull request** to the `main` branch of the original repository.

Please ensure your code adheres to the project's coding standards and includes appropriate documentation.

---

## License Information

No license is specified for this repository. All rights are reserved.

---

## Acknowledgments

*   [React Native](https://reactnative.dev/)
*   [Firebase](https://firebase.google.com/)
*   [Stripe](https://stripe.com/)
*   [Expo](https://expo.dev/)
