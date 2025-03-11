import React from 'react';
import { ScrollView, View, Text, StyleSheet, SafeAreaView } from 'react-native';

const AboutUsScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>

        <Text style={styles.text}>
          Technest Ghazi (BNPL System) is a revolutionary mobile application developed by a team of BSIT students at the College of Arts and Sciences (TCAS), Sialkot, with the aim of transforming the e-commerce experience in Pakistan. Our team, consisting of Abdul Manan, Muhammad Bilal, and Zaighum Abbass, worked diligently on this project to bridge the gap in the Pakistani market for Buy Now, Pay Later (BNPL) services.
        </Text>

        <Text style={styles.sectionTitle}>Our Journey</Text>
        <Text style={styles.text}>
          Our journey began with the realization that many consumers face financial constraints when shopping online, particularly when it comes to purchasing electronics. Traditional payment methods often limit the ability of customers to buy the products they need, and we wanted to find a way to make shopping more accessible. This led to the creation of Technest Ghazi, a platform that allows users to shop for their desired products while offering flexible payment options like BNPL and Cash on Delivery (COD).
        </Text>

        <Text style={styles.text}>
          Through this app, we hope to empower consumers by providing them with the flexibility they need to make purchases that are more suited to their financial capabilities. By integrating modern technology such as React Native for mobile development and Firebase for backend services, we have built an intuitive and secure platform for Ghazi Khan Electronics to reach a broader audience.
        </Text>

        <Text style={styles.sectionTitle}>The Story Behind Technest Ghazi</Text>
        <Text style={styles.text}>
          As students of BSIT at TCAS Sialkot, we were tasked with a project that would not only showcase our skills but also solve real-world problems. We noticed that many people in Pakistan, especially in smaller towns and cities, were limited by traditional payment methods. With the rise of e-commerce globally, we saw a significant opportunity to develop a flexible and accessible platform for online shopping.
        </Text>

        <Text style={styles.text}>
          Our goal was to create a system where consumers could buy products they need without having to worry about immediate financial strain. Thus, Buy Now, Pay Later (BNPL) was integrated into the platform as a solution to help consumers afford purchases over time, easing their financial burden.
        </Text>

        <Text style={styles.sectionTitle}>Our Team</Text>
        <Text style={styles.text}>Abdul Manan: Focused on the app’s core architecture and user experience design.</Text>
        <Text style={styles.text}>Muhammad Bilal: Played a crucial role in integrating backend services and ensuring smooth payment processing.</Text>
        <Text style={styles.text}>Zaighum Abbass: Worked on user interface design and customer interaction features, ensuring an intuitive experience.</Text>

        <Text style={styles.sectionTitle}>Our Vision</Text>
        <Text style={styles.text}>
          To revolutionize e-commerce in Pakistan by creating an inclusive platform that offers flexible payment solutions, personalized shopping experiences, and exceptional customer support.
        </Text>

        <Text style={styles.sectionTitle}>Our Mission</Text>
        <Text style={styles.text}>
          To provide a seamless, secure, and flexible shopping platform that empowers customers to make purchases when they need it most, with easy payment options like BNPL and COD, and to create long-term relationships with our customers by meeting their needs and exceeding their expectations.
        </Text>

        <Text style={styles.sectionTitle}>Our Values</Text>
        <Text style={styles.text}>Customer-Centric: We put our customers at the heart of everything we do, ensuring we provide solutions that meet their needs and preferences.</Text>
        <Text style={styles.text}>Innovation: We continuously strive to improve our platform, adopting the latest technology to enhance the shopping experience.</Text>
        <Text style={styles.text}>Trust: We are dedicated to maintaining the trust of our customers by ensuring the security of their personal and payment information.</Text>
        <Text style={styles.text}>Integrity: We operate with honesty, transparency, and ethical business practices, focusing on building lasting relationships with our customers.</Text>

        <Text style={styles.sectionTitle}>Why Choose Technest Ghazi?</Text>
        <Text style={styles.text}>Flexibility in Payment: Choose between Buy Now, Pay Later (BNPL) or Cash on Delivery (COD), making it easier for you to purchase the latest electronics without immediate financial strain.</Text>
        <Text style={styles.text}>Wide Range of Products: From the latest gadgets to home appliances, we offer a variety of high-quality products tailored to your needs.</Text>
        <Text style={styles.text}>Personalized Experience: Get recommendations based on your preferences and previous purchases.</Text>
        <Text style={styles.text}>Real-Time Customer Support: Our support team is always ready to assist you with any queries via live chat.</Text>

        <Text style={styles.sectionTitle}>Contact Us</Text>
        <Text style={styles.text}>
          If you have any further questions or need assistance, please feel free to contact us at:
        </Text>

        <Text style={styles.text}>Technest Ghazi (BNPL System)</Text>
        <Text style={styles.text}>Email: support@technestghazi.com</Text>
        <Text style={styles.text}>Phone: +92-XXX-XXXX-XXXX</Text>
        <Text style={styles.text}>Address: Ghazi Khan Electronics, [Your Address], Pakistan</Text>
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
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    color: 'black',
  },
  text: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
    marginBottom: 10,
  },
});

export default AboutUsScreen;
