import React from "react";
import { View, FlatList, StyleSheet } from "react-native";
import { Card, Text, Avatar, Divider, List } from "react-native-paper";
import Icon from "react-native-vector-icons/Ionicons";

const messages = [
  { id: "1", name: "John Doe", message: "Hey! How are you?", time: "2m ago", avatar: "https://via.placeholder.com/50" },
  { id: "2", name: "Jane Smith", message: "Let's catch up later.", time: "5m ago", avatar: "https://via.placeholder.com/50" },
  { id: "3", name: "Mike Johnson", message: "Can you send the report?", time: "10m ago", avatar: "https://via.placeholder.com/50" },
];

const notifications = [
  { id: "1", text: "📢 Your order has been shipped!", time: "1h ago" },
  { id: "2", text: "🔔 New friend request from Alex.", time: "3h ago" },
];

export default function UserOrderScreen() {
  return (
    <View style={styles.container}>
      {/* Messages Section */}
      <Text style={styles.header}>Messages</Text>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card style={styles.messageCard}>
            <View style={styles.messageRow}>
              <Avatar.Image size={50} source={{ uri: item.avatar }} />
              <View style={styles.messageContent}>
                <Text style={styles.messageName}>{item.name}</Text>
                <Text style={styles.messageText}>{item.message}</Text>
              </View>
              <Text style={styles.messageTime}>{item.time}</Text>
            </View>
          </Card>
        )}
      />

      {/* Divider */}
      <Divider style={styles.divider} />

      {/* Notifications Section */}
      <Text style={styles.header}>Notifications</Text>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <List.Item
            title={item.text}
            description={item.time}
            left={(props) => <Icon name="notifications-outline" size={24} color="black" {...props} />}
          />
        )}
      />
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
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  messageCard: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: "#f9f9f9",
    elevation: 2,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  messageContent: {
    flex: 1,
    marginLeft: 10,
  },
  messageName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  messageText: {
    fontSize: 14,
    color: "#555",
  },
  messageTime: {
    fontSize: 12,
    color: "#888",
  },
  divider: {
    marginVertical: 15,
  },
});
