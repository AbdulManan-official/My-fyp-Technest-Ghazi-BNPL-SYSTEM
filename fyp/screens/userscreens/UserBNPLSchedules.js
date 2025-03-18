import React, { useState } from 'react';
import { StyleSheet, Text, View, Button } from 'react-native';
import * as Progress from 'react-native-progress';  // Import Progress Bar component

export default function UserBNPLSchedules() {
  // Dummy Data for the installment plan
  const [installmentProgress, setInstallmentProgress] = useState(0); // Tracks how much has been paid for the installment plan
  const [totalAmount] = useState(1000); // Total amount for BNPL (for example)
  const [installmentCount] = useState(5); // Total installment count

  const handleInstallmentPayment = () => {
    if (installmentProgress < 1) {
      setInstallmentProgress(installmentProgress + 1 / installmentCount); // Increase progress
    }
  };

  // Dummy data for the fixed duration plan
  const fixedAmount = 1000;
  const fixedPaymentDate = "2023-05-15"; // Example of a fixed payment date

  return (
    <View style={styles.container}>
      <Text style={styles.text}>This is your BNPL Schedule Screen</Text>

      {/* Installment Plan */}
      <View style={styles.installmentContainer}>
        <Text style={styles.planTitle}>Installment Plan</Text>
        <Text style={styles.text}>Total Amount: ${totalAmount}</Text>
        <Text style={styles.text}>Installments: {installmentCount}</Text>

        {/* Rich UI Progress Bar */}
        <View style={styles.progressBarContainer}>
          <Text style={styles.progressText}>
            Progress: {Math.round(installmentProgress * 100)}%
          </Text>

          {/* Rich UI Progress Bar using react-native-progress */}
          <Progress.Bar
            progress={installmentProgress}
            width={300}
            height={20}
            color="#FF4500"  // Customize the color
            unfilledColor="#E0E0E0"  // Background of progress bar
            borderRadius={10}  // Rounded corners for smooth appearance
            animationType="spring" // Smooth animation
          />
        </View>
        <Button title="Make Payment" onPress={handleInstallmentPayment} />
      </View>

      {/* Fixed Duration Plan */}
      <View style={styles.fixedContainer}>
        <Text style={styles.planTitle}>Fixed Duration Plan</Text>
        <Text style={styles.text}>Amount Due: ${fixedAmount}</Text>
        <Text style={styles.text}>Payment Date: {fixedPaymentDate}</Text>
        <Text style={styles.text}>This is a one-time payment.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    padding: 20,
  },
  text: {
    fontSize: 18,
    color: '#333',
    marginBottom: 10,
  },
  planTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FF4500',
    marginBottom: 15,
  },
  installmentContainer: {
    width: '100%',
    padding: 15,
    backgroundColor: '#FFF',
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  progressBarContainer: {
    width: '80%',
    marginVertical: 20,
    alignItems: 'center',
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  fixedContainer: {
    width: '100%',
    padding: 15,
    backgroundColor: '#FFF',
    borderRadius: 10,
    alignItems: 'center',
  },
});
