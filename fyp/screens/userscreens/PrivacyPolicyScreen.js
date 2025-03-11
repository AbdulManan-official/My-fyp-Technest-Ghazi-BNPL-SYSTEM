import React from 'react';
import { ScrollView, View, Text, StyleSheet, SafeAreaView } from 'react-native';

const PrivacyPolicyScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        
        <Text style={styles.sectionTitle}>1. Information We Collect</Text>
        <Text style={styles.text}>
          When you use the Technest Ghazi (BNPL System) mobile application, we collect the following types of information:
        </Text>
        
        <Text style={styles.subHeading}>1.1. Personal Information</Text>
        <Text style={styles.text}>
          - Account Information: When you sign up or log in to the app, we collect your personal details, including your name, email address, phone number, and profile picture.
          {'\n'}- Payment Information: For BNPL services, we collect information regarding your payment method, billing information, and payment history.
          {'\n'}- Verification Documents: Images and documents you upload for verification purposes, such as front and back images of an ID and selfies.
        </Text>

        <Text style={styles.subHeading}>1.2. Non-Personal Information</Text>
        <Text style={styles.text}>
          - Usage Data: We collect data about how you use the app, including your interactions with the platform, device information (e.g., device type, operating system), and IP addresses.
          {'\n'}- Log Data: Our servers automatically log information when you interact with the app, including access times, error logs, and usage statistics.
        </Text>

        <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
        <Text style={styles.text}>
          We use the information we collect for the following purposes:
        </Text>
        <Text style={styles.text}>
          - Providing Services: To enable you to browse, purchase, and manage your orders, including payment options like BNPL and COD.
          {'\n'}- Personalization: To offer personalized recommendations based on your preferences and past purchases.
          {'\n'}- Verification: To verify your identity and process your BNPL application by collecting and storing your verification documents securely.
          {'\n'}- Customer Support: To provide customer assistance via live chat and support channels.
          {'\n'}- Notifications: To send you push notifications regarding your orders, payment reminders, promotions, and other updates.
          {'\n'}- Analytics: To analyze usage data to improve the app and enhance your experience.
        </Text>

        <Text style={styles.sectionTitle}>3. Data Sharing and Disclosure</Text>
        <Text style={styles.text}>
          We do not share your personal data with third parties except in the following cases:
        </Text>
        <Text style={styles.text}>
          - Service Providers: We may share your data with third-party vendors, service providers, or affiliates that help us operate the app, such as payment processors, cloud storage services (like Firebase), and analytics services.
          {'\n'}- Legal Requirements: We may disclose your personal information if required by law, regulation, legal process, or governmental request, or to protect our legal rights and interests.
          {'\n'}- Business Transfers: In the event of a merger, acquisition, or sale of assets, your personal information may be transferred to the new owner.
        </Text>

        <Text style={styles.sectionTitle}>4. Data Security</Text>
        <Text style={styles.text}>
          We take the security of your personal information seriously. We implement reasonable administrative, technical, and physical measures to protect your data from unauthorized access, disclosure, alteration, or destruction. However, no method of transmission over the internet or electronic storage is 100% secure, and we cannot guarantee its absolute security.
        </Text>

        <Text style={styles.sectionTitle}>5. Data Retention</Text>
        <Text style={styles.text}>
          We retain your personal information for as long as necessary to provide you with the services you request, comply with our legal obligations, resolve disputes, and enforce our agreements. After this period, we will securely delete or anonymize your data.
        </Text>

        <Text style={styles.sectionTitle}>6. User Rights</Text>
        <Text style={styles.text}>
          Depending on your location, you may have certain rights regarding your personal data, including:
        </Text>
        <Text style={styles.text}>
          - Access and Correction: You can request access to the personal data we hold about you and request corrections if it is inaccurate.
          {'\n'}- Deletion: You can request the deletion of your personal data, subject to legal and contractual obligations.
          {'\n'}- Opt-Out: You can opt-out of receiving marketing emails or push notifications by following the unsubscribe instructions in those communications or adjusting your notification settings.
        </Text>

        <Text style={styles.sectionTitle}>7. Third-Party Links</Text>
        <Text style={styles.text}>
          The Technest Ghazi (BNPL System) app may contain links to third-party websites or services that are not operated by us. We are not responsible for the content, privacy policies, or practices of third-party websites. We encourage you to review the privacy policies of any third-party services you access through the app.
        </Text>

        <Text style={styles.sectionTitle}>8. Changes to This Privacy Policy</Text>
        <Text style={styles.text}>
          We may update our Privacy Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will notify you of any significant changes by updating the "Effective Date" at the top of this policy. Please review this Privacy Policy periodically for any updates.
        </Text>

        <Text style={styles.sectionTitle}>9. Contact Us</Text>
        <Text style={styles.text}>
          If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:
        </Text>
        <Text style={styles.text}>
          Technest Ghazi (BNPL System)
          {'\n'}Email: support@technestghazi.com
          {'\n'}Phone: +92-XXX-XXXX-XXXX
          {'\n'}Address: Ghazi Khan Electronics, [Your Address], Pakistan
        </Text>
        <Text style={styles.date}>Effective Date: November 20, 2024</Text>

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
  subHeading: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 30,
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
  noImageText: {
    color: 'gray',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 5,
  },
});

export default PrivacyPolicyScreen;
