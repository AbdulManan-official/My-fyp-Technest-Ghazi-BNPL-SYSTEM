import React, { useState } from "react";
import { View, FlatList, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { Card, Text, Button, TextInput, Modal, Portal, Provider } from "react-native-paper";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

export default function CategoryScreen() {
  const [categories, setCategories] = useState([
    { id: "1", name: "Electronics" },
    { id: "2", name: "Fashion" },
    { id: "3", name: "Home & Kitchen" },
  ]);

  const [visible, setVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryName, setCategoryName] = useState("");

  const showModal = (category) => {
    setSelectedCategory(category);
    setCategoryName(category?.name || "");
    setVisible(true);
  };

  const hideModal = () => setVisible(false);

  const handleSave = () => {
    if (selectedCategory) {
      // Edit category
      setCategories((prevCategories) =>
        prevCategories.map((c) => (c.id === selectedCategory.id ? { ...c, name: categoryName } : c))
      );
    } else {
      // Add new category
      const newCategory = { id: Math.random().toString(), name: categoryName };
      setCategories([...categories, newCategory]);
    }
    hideModal();
  };

  const handleDelete = (id) => {
    Alert.alert("Delete Category", "Are you sure you want to delete this category?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", onPress: () => setCategories(categories.filter((c) => c.id !== id)), style: "destructive" },
    ]);
  };

  const renderCategory = ({ item }) => (
    <Card style={styles.categoryCard}>
      <View style={styles.categoryRow}>
        <Icon name="shape" size={24} color="#007bff" />
        <Text style={styles.categoryName}>{item.name}</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity onPress={() => showModal(item)}>
            <Icon name="pencil" size={24} color="blue" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item.id)}>
            <Icon name="trash-can" size={24} color="red" />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

  return (
    <Provider>
      <View style={styles.container}>
        <Text style={styles.header}>Category Management</Text>

        {/* Category List */}
        <FlatList data={categories} keyExtractor={(item) => item.id} renderItem={renderCategory} />

        {/* Add Category Button */}
        <Button mode="contained" onPress={() => showModal(null)} style={styles.addButton}>
          Add New Category
        </Button>

        {/* Modal for Adding/Editing Category */}
        <Portal>
          <Modal visible={visible} onDismiss={hideModal} contentContainerStyle={styles.modal}>
            <Text style={styles.modalTitle}>{selectedCategory ? "Edit Category" : "Add Category"}</Text>

            <TextInput label="Category Name" value={categoryName} onChangeText={setCategoryName} style={styles.input} />

            <Button mode="contained" onPress={handleSave} style={styles.saveButton}>
              Save
            </Button>
          </Modal>
        </Portal>
      </View>
    </Provider>
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
    textAlign: "center",
  },
  categoryCard: {
    padding: 10,
    marginBottom: 10,
    borderRadius: 10,
    backgroundColor: "#f9f9f9",
    elevation: 3,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
    marginLeft: 10,
  },
  actionButtons: {
    flexDirection: "row",
  },
  addButton: {
    marginTop: 15,
  },
  modal: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    marginHorizontal: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  input: {
    marginBottom: 10,
  },
  saveButton: {
    marginTop: 15,
  },
});
