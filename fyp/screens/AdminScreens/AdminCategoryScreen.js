import React, { useEffect, useRef, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Dimensions, Text, TextInput, RefreshControl,
  ActivityIndicator, Platform, Alert, ScrollView, SafeAreaView // Added SafeAreaView
} from 'react-native';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query, // Added query
  orderBy // Added orderBy
} from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // make sure this path is correct

import Icon from 'react-native-vector-icons/FontAwesome';
import {
  FAB, Modal, Portal, Provider,
  TextInput as PaperInput, Button
} from 'react-native-paper';

const { width, height } = Dimensions.get('window'); // Added height

export default function AdminCategoryScreen({ navigation }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true); // Start loading true
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  // const [noResults, setNoResults] = useState(false); // Can derive this from filteredCategories.length
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editCategory, setEditCategory] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false); // Keep modal edit state logic

  const tempNameRef = useRef('');
  const tempDescRef = useRef('');

  // --- Fetch Logic ---
  const fetchCategories = async (isRefresh = false) => {
     if (!isRefresh) setLoading(true);
    try {
      // Order by name in the query
      const categoriesQuery = query(collection(db, 'Category'), orderBy('categoryName'));
      const querySnapshot = await getDocs(categoriesQuery);
      const fetched = [];
      querySnapshot.forEach(docSnap => {
        fetched.push({ id: docSnap.id, ...docSnap.data() });
      });
      setCategories(fetched);
      // Apply current search query to the newly fetched list
      handleSearch(searchQuery, fetched);
    } catch (error) {
      console.error('Firestore fetch failed:', error);
      Alert.alert("Error", "Could not fetch categories.");
    } finally {
      setLoading(false);
      setHasFetched(true);
      if (isRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCategories(true);
  };

  // --- Search Logic ---
  const handleSearch = (query, currentCategories = categories) => {
    setSearchQuery(query);
    if (query) {
      const lowerCaseQuery = query.toLowerCase();
      const filteredData = currentCategories.filter(category =>
        category.categoryName.toLowerCase().includes(lowerCaseQuery) ||
        (category.categoryDescription && category.categoryDescription.toLowerCase().includes(lowerCaseQuery)) // Optional: search desc
      );
      setFilteredCategories(filteredData);
    } else {
      setFilteredCategories(currentCategories);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setFilteredCategories(categories);
  };

  // --- Modal Logic ---
  const openEditModal = (category) => {
    setEditCategory(category);
    tempNameRef.current = category.categoryName;
    tempDescRef.current = category.categoryDescription || ''; // Handle potentially missing description
    setModalVisible(true);
    setShowEditForm(false); // Start in view mode
  };

  const openAddModal = () => {
    setEditCategory(null);
    tempNameRef.current = '';
    tempDescRef.current = '';
    setModalVisible(true);
    setShowEditForm(true); // Start in edit mode for add
  };

   const closeModal = () => {
    setModalVisible(false);
    setEditCategory(null);
    // Don't clear refs here, let them be set on modal open
    setSaving(false);
    setDeleting(false); // Reset deleting state too
  };

  // --- Save/Update Logic ---
  const handleAddOrEditCategory = async () => {
    const name = tempNameRef.current.trim();
    const desc = tempDescRef.current.trim();

    if (!name) {
      return Alert.alert('Validation Error', 'Category Name cannot be empty.');
    }

    const isDuplicate = categories.some(cat =>
      cat.categoryName.toLowerCase() === name.toLowerCase() &&
      (!editCategory || cat.id !== editCategory.id)
    );

    if (isDuplicate) {
      return Alert.alert('Duplicate Category', 'A category with this name already exists.');
    }

    setSaving(true);
    try {
      const payload = {
        categoryName: name,
        categoryDescription: desc,
        // Add/update timestamps if desired
        // updatedAt: new Date(),
        // ...( !editCategory && { createdAt: new Date() } )
      };

      if (editCategory) {
        const categoryRef = doc(db, 'Category', editCategory.id);
        await updateDoc(categoryRef, payload);
      } else {
        await addDoc(collection(db, 'Category'), payload);
      }

      await fetchCategories(); // Refresh list
      closeModal(); // Close modal on success
    } catch (error) {
      console.error('Error saving category:', error);
      Alert.alert('Save Error', 'Could not save the category.');
    } finally {
      setSaving(false);
    }
  };

  // --- Delete Logic (Triggered from Modal) ---
  const handleDelete = async (id) => {
    // Confirmation Alert
    Alert.alert("Delete Category", "Are you sure you want to delete this category? This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeleting(true); // Indicate deletion process start
          try {
            await deleteDoc(doc(db, 'Category', id));
            await fetchCategories(); // Refresh list
            closeModal(); // Close modal on success
          } catch (error) {
            console.error('Error deleting category:', error);
            Alert.alert('Delete Error', 'Could not delete the category.');
            // Reset deleting state even on error if needed
            setDeleting(false);
          }
          // No finally needed here as closeModal resets deleting state
        },
      },
    ]);
  };

  // --- Render Helper for List Items ---
  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity style={styles.listItem} onPress={() => openEditModal(item)}>
      <View style={styles.listItemContent}>
         <Text style={styles.categoryName} numberOfLines={1} ellipsizeMode="tail">{item.categoryName}</Text>
         {/* Conditionally render description only if it exists */}
         {item.categoryDescription ? (
            <Text style={styles.categoryDescription} numberOfLines={2} ellipsizeMode="tail">
                {item.categoryDescription}
            </Text>
         ) : null}
      </View>
      <Icon name="chevron-right" size={16} color="#AAAAAA" style={styles.chevronIcon} />
    </TouchableOpacity>
  );

  // --- Render Helper for Empty List / Loading ---
  const renderListEmptyComponent = () => {
     if (loading && !hasFetched) {
      return (
        <View style={styles.emptyListContainer}>
          <ActivityIndicator size="large" color="#FF0000" />
          <Text style={styles.emptyListText}>Loading Categories...</Text>
        </View>
      );
    }
    if (hasFetched) {
        if (searchQuery && filteredCategories.length === 0) {
        return (
            <View style={styles.emptyListContainer}>
            <Icon name="search" size={40} color="#CCCCCC" />
            <Text style={styles.emptyListText}>No categories match "{searchQuery}"</Text>
            </View>
        );
        }
        if (!searchQuery && categories.length === 0) {
        return (
            <View style={styles.emptyListContainer}>
            <Icon name="folder-open-o" size={40} color="#CCCCCC" /> {/* Changed icon */}
            <Text style={styles.emptyListText}>No categories found.</Text>
            <Text style={styles.emptyListSubText}>Tap the '+' button to add one!</Text>
            </View>
        );
        }
    }
    return null;
  };

  return (
    <Provider>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            {/* No title */}
            <View style={styles.searchBarContainer}>
              <Icon name="search" size={18} color="black" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search categories..." // Updated placeholder
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={(text) => handleSearch(text, categories)} // Use handleSearch correctly
                returnKeyType="search"
                clearButtonMode="while-editing" // iOS clear button
              />
              {searchQuery.length > 0 && Platform.OS === 'android' && (
                <TouchableOpacity onPress={clearSearch} style={styles.clearSearchButton}>
                  <Icon name="times-circle" size={18} color="black" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Content Area */}
          <FlatList
            data={filteredCategories}
            keyExtractor={(item) => item.id}
            renderItem={renderCategoryItem} // Use the render helper
            contentContainerStyle={styles.listContentContainer} // Apply styles
            ListEmptyComponent={renderListEmptyComponent} // Use empty state helper
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh} // Use correct refresh function
                colors={["#FF0000"]}
                tintColor={"#FF0000"}
              />
            }
            // Remove ItemSeparatorComponent as border is on the item
          />

          {/* FAB */}
          <FAB
             style={styles.fab} // Apply consistent FAB style
             icon="plus"
             color="white"
             onPress={openAddModal}
             accessibilityLabel="Add new Category"
          />

          {/* Modal */}
          <Portal>
            <Modal
              visible={modalVisible}
              onDismiss={closeModal} // Use consistent close function
              contentContainerStyle={styles.modalContent} // Apply consistent modal style
              >
              {/* Keep existing ScrollView and Form structure */}
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>{editCategory ? 'Category Options' : 'Add New Category'}</Text>

                <PaperInput
                  label="Category Name"
                  defaultValue={tempNameRef.current}
                  onChangeText={(text) => tempNameRef.current = text}
                  mode="outlined"
                  style={styles.modalInput} // Use consistent input style name
                  outlineColor="black" // Use consistent colors
                  activeOutlineColor="#FF0000"
                  disabled={editCategory && !showEditForm}
                  textColor={editCategory && !showEditForm ? '#666' : '#000'} // Adjusted disabled color
                />
                <PaperInput
                  label="Category Description"
                  defaultValue={tempDescRef.current}
                  onChangeText={(text) => tempDescRef.current = text}
                  mode="outlined"
                  style={styles.modalInput} // Use consistent input style name
                  outlineColor="black" // Use consistent colors
                  activeOutlineColor="#FF0000"
                  disabled={editCategory && !showEditForm}
                  textColor={editCategory && !showEditForm ? '#666' : '#000'} // Adjusted disabled color
                  multiline // Allow multiline description
                  numberOfLines={3} // Suggest height
                />

                {/* Keep existing button logic */}
                <View style={styles.modalButtonRow}>
                  {editCategory && !showEditForm ? (
                    <>
                      <Button onPress={() => setShowEditForm(true)} mode="outlined" textColor="#FF0000" style={styles.modalButton}>Edit</Button>
                      <Button
                        onPress={() => handleDelete(editCategory.id)}
                        mode="outlined"
                        textColor="red"
                        style={[styles.modalButton, styles.deleteButton]} // Consistent + specific style
                        loading={deleting}
                        disabled={deleting || saving} // Also disable if saving
                      >
                        Delete
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button onPress={closeModal} mode="outlined" textColor="#FF0000" style={styles.modalButton}>Cancel</Button>
                      <Button
                        mode="contained"
                        onPress={handleAddOrEditCategory}
                        style={[styles.modalButton, styles.saveButton]} // Consistent + specific style
                        loading={saving}
                        disabled={saving || deleting} // Also disable if deleting
                      >
                        {editCategory ? 'Update' : 'Save'}
                      </Button>
                    </>
                  )}
                </View>
              </ScrollView>
            </Modal>
          </Portal>
        </View>
      </SafeAreaView>
    </Provider>
  );
}


// --- Styles (Adapted from BNPLPlansScreen) ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Use white background overall
  },
  // --- Header ---
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? 15 : 10,
    paddingBottom: 10,
    paddingHorizontal: 20,
    border:'2',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
 searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    // --- CHANGE THIS LINE ---
    backgroundColor: '#EFEFEF', // Changed from #F4F6F8
    // ------------------------
    borderRadius: 30,
    paddingHorizontal: 15,
    height: 45,
    marginTop: 5,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    paddingVertical: Platform.OS === 'ios' ? 10 : 5,
  },
  clearSearchButton: {
    marginLeft: 10,
    padding: 5,
  },
  // --- List ---
  listContentContainer: {
    paddingBottom: 90, // Space below list for FAB
    flexGrow: 1,
    backgroundColor: '#FFFFFF', // Ensure list background is white
  },
  listItem: { // Renamed from 'card'
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    paddingHorizontal: 20, // Padding inside the item
    borderBottomWidth: 1, // Separator line
    borderBottomColor: '#EEEEEE',
    flexDirection: 'row',
    alignItems: 'center', // Vertically align content and chevron
  },
  listItemContent: {
    flex: 1, // Take available space
    marginRight: 10, // Space before chevron
  },
  categoryName: { // Style for the main name
    fontSize: 17,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4, // Add space if description exists
  },
  categoryDescription: { // Style for the description
    fontSize: 14,
    color: '#666666',
    marginTop: 4, // Removed top margin, handled by name's bottom margin
  },
  chevronIcon: {
    color:'black'
  },
  // --- Empty List / Loader ---
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    marginTop: height * 0.1,
    backgroundColor: '#FFFFFF', // Match list background
  },
  emptyListText: {
    fontSize: 18,
    color: "#777777",
    textAlign: "center",
    marginTop: 15,
    fontWeight: '500',
  },
   emptyListSubText: {
    fontSize: 14,
    color: "#999999",
    textAlign: "center",
    marginTop: 8,
  },
  // --- FAB ---
  fab: {
    position: 'absolute',
    margin: 16,
    right: 10,
    bottom: 20,
    backgroundColor: '#FF0000', // Consistent red color
     elevation: 6,
     shadowColor: '#000',
     shadowOffset: { width: 0, height: 4 },
     shadowOpacity: 0.3,
     shadowRadius: 4,
  },
  // --- Modal ---
  modalContent: { // Style for the modal container
    backgroundColor: 'white',
    padding: 25,
    borderRadius: 15,
    marginHorizontal: 15,
    maxHeight: height * 0.85, // Limit height
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  modalTitle: { // Style from original, looks fine
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20, // Increased margin
    textAlign: 'center',
  },
  modalInput: { // Consistent style name for modal inputs
    marginBottom: 15, // Consistent spacing
  },
  modalButtonRow: { // Style for the row containing modal buttons
     flexDirection: 'row',
     justifyContent: 'space-between', // Or 'flex-end' etc.
     marginTop: 20, // Space above buttons
  },
  modalButton: { // Base style for modal buttons
    flex: 1, // Make buttons share space
    marginHorizontal: 5, // Add horizontal margin between buttons
  },
  saveButton: { // Specific style for save/update button
     backgroundColor: '#FF0000',
  },
   deleteButton: { // Specific style for delete button
     borderColor: 'red', // Ensure border is red for outlined delete
  },
});