import React from "react";
import { View, FlatList, StyleSheet } from "react-native";
import { Card, Text, Divider } from "react-native-paper";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const orders = [
  { id: "1", name: "iPhone 14", status: "Active", price: "$999" },
  { id: "2", name: "Nike Sneakers", status: "Active", price: "$120" },
  { id: "3", name: "Samsung TV", status: "Pending", price: "$499" },
  { id: "4", name: "Laptop", status: "Pending", price: "$899" },
  { id: "5", name: "Coffee Maker", status: "Delivered", price: "$79" },
  { id: "6", name: "Headphones", status: "Delivered", price: "$199" },
];

export default function OrderScreen() {
  const renderOrder = ({ item }) => (
    <Card style={styles.orderCard}>
      <View style={styles.orderRow}>
        <Icon name="package-variant-closed" size={24} color="#007bff" />
        <View style={styles.orderContent}>
          <Text style={styles.orderName}>{item.name}</Text>
          <Text style={styles.orderPrice}>{item.price}</Text>
        </View>
        <Text style={[styles.orderStatus, getStatusStyle(item.status)]}>{item.status}</Text>
      </View>
    </Card>
  );

  const getStatusStyle = (status) => {
    switch (status) {
      case "Active":
        return { color: "#ff9800" };
      case "Pending":
        return { color: "#2196F3" };
      case "Delivered":
        return { color: "#4CAF50" };
      default:
        return {};
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Orders</Text>

      {/* Active Orders */}
      <Text style={styles.sectionTitle}>🚀 Active Orders</Text>
      <FlatList data={orders.filter(o => o.status === "Active")} keyExtractor={(item) => item.id} renderItem={renderOrder} />

      <Divider style={styles.divider} />

      {/* Pending Orders */}
      <Text style={styles.sectionTitle}>⏳ Pending Orders</Text>
      <FlatList data={orders.filter(o => o.status === "Pending")} keyExtractor={(item) => item.id} renderItem={renderOrder} />

      <Divider style={styles.divider} />

      {/* Delivered Orders */}
      <Text style={styles.sectionTitle}>✅ Delivered Orders</Text>
      <FlatList data={orders.filter(o => o.status === "Delivered")} keyExtractor={(item) => item.id} renderItem={renderOrder} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: "#fff",
  },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 5,
  },
  divider: {
    marginVertical: 15,
  },
  orderCard: {
    padding: 10,
    marginBottom: 10,
    borderRadius: 10,
    backgroundColor: "#f9f9f9",
    elevation: 3,
  },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  orderContent: {
    flex: 1,
    marginLeft: 10,
  },
  orderName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  orderPrice: {
    fontSize: 14,
    color: "#555",
  },
  orderStatus: {
    fontSize: 14,
    fontWeight: "bold",
  },
});
