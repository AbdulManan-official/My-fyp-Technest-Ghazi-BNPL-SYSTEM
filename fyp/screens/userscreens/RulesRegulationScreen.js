import React from 'react';
import { ScrollView, View, Text, StyleSheet, SafeAreaView } from 'react-native';

const RulesRegulationScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        
        <Text style={styles.text}>
          By using our app and services, you agree to comply with the following Rules and Regulations. Please read them carefully.
        </Text>

        <Text style={styles.sectionTitle}>1. Eligibility</Text>
        <Text style={styles.subHeading}>1.1. Account Registration</Text>
        <Text style={styles.text}>
          To access the services of the app, users must create an account with accurate and up-to-date information, including their full name, email address, phone number, and payment information. You are responsible for maintaining the confidentiality of your account credentials.
        </Text>

        <Text style={styles.subHeading}>1.2. Verification</Text>
        <Text style={styles.text}>
          For the BNPL (Buy Now Pay Later) feature, users must complete an identity verification process, which includes uploading identification documents. The verification must be approved before accessing BNPL services.
        </Text>

        <Text style={styles.sectionTitle}>2. Use of the App</Text>
        <Text style={styles.subHeading}>2.1. Personal Use Only</Text>
        <Text style={styles.text}>
          The Technest Ghazi (BNPL System) app is intended for personal, non-commercial use only. You may not use the app for any unlawful purpose, including reselling items purchased through the platform.
        </Text>

        <Text style={styles.subHeading}>2.2. Product Listings and Descriptions</Text>
        <Text style={styles.text}>
          While we strive for accuracy, Technest Ghazi does not guarantee the accuracy, completeness, or reliability of product listings, descriptions, or images. The app may also include typographical errors or inaccuracies.
        </Text>

        <Text style={styles.subHeading}>2.3. Order Limitations</Text>
        <Text style={styles.text}>
          We reserve the right to set limits on the quantity of products that can be purchased through the app, including purchase limits on certain items based on stock availability and customer verification.
        </Text>

        <Text style={styles.sectionTitle}>3. Payment Terms</Text>
        <Text style={styles.subHeading}>3.1. Payment Methods</Text>
        <Text style={styles.text}>
          Technest Ghazi offers Buy Now Pay Later (BNPL) and Cash on Delivery (COD) options. For BNPL, users must agree to the terms of payment installment plans, including the payment schedule and duration.
        </Text>

        <Text style={styles.subHeading}>3.2. BNPL Payment Plan</Text>
        <Text style={styles.text}>
          The BNPL (Buy Now Pay Later) option allows you to split the payment for a product into installments. You must ensure that you make the payment for each installment on time. Failure to make timely payments may result in penalties, account suspension, or the rejection of future BNPL applications.
        </Text>

        <Text style={styles.subHeading}>3.3. Payment Processing Fees</Text>
        <Text style={styles.text}>
          In some cases, payment processing fees may apply based on the payment method you choose. These fees will be clearly stated during the checkout process.
        </Text>

        <Text style={styles.subHeading}>3.4. Late Payments</Text>
        <Text style={styles.text}>
          Failure to make payments by the due date may incur additional charges, and late payment fees may be applied. Continued non-payment may result in your account being restricted or suspended.
        </Text>

        <Text style={styles.sectionTitle}>4. Responsibilities of Users</Text>
        <Text style={styles.subHeading}>4.1. Accurate Information</Text>
        <Text style={styles.text}>
          You agree to provide accurate, current, and complete information when creating an account, placing orders, and making payments. You are responsible for keeping your account information updated.
        </Text>

        <Text style={styles.subHeading}>4.2. Security</Text>
        <Text style={styles.text}>
          You are responsible for maintaining the security of your account and password. You must notify us immediately if you suspect any unauthorized use of your account or a security breach.
        </Text>

        <Text style={styles.subHeading}>4.3. Compliance with Local Laws</Text>
        <Text style={styles.text}>
          You agree to comply with all local laws and regulations regarding the purchase and use of products, including the BNPL payment plans in your country of residence.
        </Text>

        <Text style={styles.sectionTitle}>5. Prohibited Activities</Text>
        <Text style={styles.subHeading}>5.1. Fraudulent Activities</Text>
        <Text style={styles.text}>
          Users are prohibited from engaging in fraudulent activities, including using false information during account registration, submitting false payment information, or attempting to defraud Technest Ghazi or any other users.
        </Text>

        <Text style={styles.subHeading}>5.2. Illegal Transactions</Text>
        <Text style={styles.text}>
          Users are prohibited from using the Technest Ghazi app for illegal activities such as money laundering, financing terrorism, or the purchase of illegal products.
        </Text>

        <Text style={styles.subHeading}>5.3. Abuse of Customer Support</Text>
        <Text style={styles.text}>
          Harassment, abusive behavior, or the use of inappropriate language when interacting with customer support agents is strictly prohibited. We reserve the right to take appropriate actions, including suspending your account, if such behavior is observed.
        </Text>

        <Text style={styles.sectionTitle}>6. Refund and Return Policy</Text>
        <Text style={styles.subHeading}>6.1. Refunds and Returns</Text>
        <Text style={styles.text}>
          Refunds and returns are subject to Technest Ghazi’s return policy, which allows you to return eligible products within a specified period. The return policy applies to both COD and BNPL purchases.
        </Text>

        <Text style={styles.subHeading}>6.2. BNPL Refunds</Text>
        <Text style={styles.text}>
          If a product is returned after using BNPL, any refunds will be processed according to the BNPL payment plan, and the remaining payment balance will be adjusted accordingly.
        </Text>

        <Text style={styles.subHeading}>6.3. Damaged Products</Text>
        <Text style={styles.text}>
          If you receive a damaged or defective product, you must report it within 48 hours of receiving the product to be eligible for a refund or replacement.
        </Text>

        <Text style={styles.sectionTitle}>7. Privacy and Data Protection</Text>
        <Text style={styles.subHeading}>7.1. Data Collection</Text>
        <Text style={styles.text}>
          We collect personal and payment information necessary to process orders, verify identities, and offer personalized recommendations. All data collected will be handled in accordance with our Privacy Policy.
        </Text>

        <Text style={styles.subHeading}>7.2. Security of Personal Information</Text>
        <Text style={styles.text}>
          We employ industry-standard security measures to protect your personal and financial data. However, no method of data transmission over the internet is 100% secure.
        </Text>

        <Text style={styles.subHeading}>7.3. Data Retention</Text>
        <Text style={styles.text}>
          We retain your personal data for as long as necessary to provide our services and comply with legal obligations.
        </Text>

        <Text style={styles.sectionTitle}>8. Account Suspension and Termination</Text>
        <Text style={styles.subHeading}>8.1. Suspension of Account</Text>
        <Text style={styles.text}>
          We reserve the right to suspend or terminate your account if you violate these Rules and Regulations or engage in activities that may harm the Technest Ghazi platform or other users.
        </Text>

        <Text style={styles.subHeading}>8.2. Termination of BNPL Service</Text>
        <Text style={styles.text}>
          If you fail to make timely payments for BNPL installments, your access to BNPL services may be suspended or terminated.
        </Text>

        <Text style={styles.sectionTitle}>9. Limitation of Liability</Text>
        <Text style={styles.subHeading}>9.1. Limitation of Liability</Text>
        <Text style={styles.text}>
          Technest Ghazi is not liable for any indirect, incidental, or consequential damages arising from the use or inability to use the app. Our liability is limited to the amount paid by the user for the product or service.
        </Text>

        <Text style={styles.subHeading}>9.2. No Guarantee of Service Availability</Text>
        <Text style={styles.text}>
          We do not guarantee that the app will be uninterrupted, error-free, or free of viruses. We are not responsible for any downtime, data loss, or any other issue arising from the use of the app.
        </Text>

        <Text style={styles.sectionTitle}>10. Changes to Rules and Regulations</Text>
        <Text style={styles.text}>
          We may update these Rules and Regulations from time to time to reflect changes in our policies or to comply with legal requirements. Any updates will be communicated via the app or through email notifications. Please review the Rules regularly to stay informed about your rights and responsibilities.
        </Text>

        <Text style={styles.sectionTitle}>11. Contact Us</Text>
        <Text style={styles.text}>
          If you have any questions or concerns about these Rules and Regulations, please contact us at:
        </Text>
        <Text style={styles.text}>
          Technest Ghazi (BNPL System)
          {'\n'}Email: support@technestghazi.com
          {'\n'}Phone: +92-XXX-XXXX-XXXX
          {'\n'}Address: Ghazi Khan Electronics, [Your Address], Pakistan
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  scrollContainer: {
    padding: 20,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  subHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555',
    marginBottom: 10,
  },
  date: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 20,
  },
});

export default RulesRegulationScreen;
