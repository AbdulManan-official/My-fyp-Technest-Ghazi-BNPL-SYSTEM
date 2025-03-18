import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";

// UserOrderScreen Component
const UserOrderScreen = ({ navigation }) => {
  // Define onPress handlers for each menu item
  const handleActiveOrdersPress = () => {
    navigation.navigate('UserActiveOrders'); 
  };

  const handleBNPLSchedulePress = () => {
    navigation.navigate('UserBNPLSchedules'); // Navigate to BNPL Schedule Screen
  };

  const handleOrderHistoryPress = () => {
    navigation.navigate('OrderHistoryScreen'); // Navigate to Order History Screen
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8F8F8" }}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Orders</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollView} showsVerticalScrollIndicator={false}>
        
        {/* Extra Space Before Support & Information Section */}
        <View style={{ height: 20 }}></View>

        {/* 1. Support & Information (Icons in a Single Row) */}
        <View style={styles.sectionContainer}>
          {/* Replace Lottie animation with a local image */}
          <Image
            source={require("../../assets/file1.png")}  // Replace with your image path
            style={styles.imageStyle}
          />
        </View>

        {/* 2. Orders & Payments (First Row: 2 Icons, Second Row: 3 Icons) */}
        <LinearGradient colors={["#FF0000", "#CC0000"]} style={styles.gradientContainer}>
          <View style={styles.curvedTop}>
            <Text style={styles.sectionTitle}>Orders & Schedules</Text>
          </View>

          {/* First Row (2 Items) */}
          <View style={styles.gridContainer}>
            <MenuItem
              title="Active Orders"
              icon="local-shipping"
              onPress={handleActiveOrdersPress}
            />
            <MenuItem
              title="BNPL Schedule"
              icon="schedule"
              onPress={handleBNPLSchedulePress}
            />

            {/* Add Order History */}
            <MenuItem
              title="Order History"
              icon="history"
              onPress={handleOrderHistoryPress}
            />
          </View>

          {/* Second Row (3 Items) */}
          <View style={styles.gridContainer}></View>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
};

// Reusable Menu Item Component
const MenuItem = ({ title, icon, onPress }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={styles.iconCircle}>
      <MaterialIcons name={icon} size={22} color="red" />
    </View>
    <Text style={styles.menuText}>{title}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  headerContainer: {
    paddingVertical: 30, 
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FF0000",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  headerText: {
    fontSize: 22, 
    fontWeight: "bold",
    color: "#FFF",
    letterSpacing: 1,
  },
  scrollView: {
    paddingVertical: 10, 
    paddingHorizontal: 12,
  },
  sectionContainer: {
    backgroundColor: "#FF0000",
    borderRadius: 25,
    paddingVertical: 20, 
    marginBottom: 12, 
    marginTop: 15,  // Increased spacing above the section
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 7,
  },
  gradientContainer: {
    borderRadius: 30,
    paddingVertical: 25, 
    marginBottom: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 7,
    elevation: 8,
  },
  curvedTop: {
    borderTopLeftRadius: 30, 
    borderTopRightRadius: 30, 
    overflow: "hidden",
    width: "100%",
    alignItems: "center",
    paddingTop: 15,
  },
  sectionTitle: {
    fontSize: 22, 
    fontWeight: "bold",
    color: "#FFF",
    textAlign: "center",
    marginBottom: 10,
  },
  iconRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    width: "100%",
  },
  gridContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    width: "100%",
    marginBottom: 10, 
  },
  menuItem: {
    alignItems: "center",
    width: "30%", 
    paddingVertical: 5, 
  },
  iconCircle: {
    backgroundColor: "white",
    width: 50, 
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  menuText: {
    fontSize: 14, 
    fontWeight: "600",
    color: "#FFF",
    marginTop: 8,
    textAlign: "center",
  },
  imageStyle: {
    width: 150,  // Adjust the size of the image
    height: 150, 
    marginBottom: 20,  // Space between image and text
    borderRadius: 15,
  },
});

export default UserOrderScreen;
