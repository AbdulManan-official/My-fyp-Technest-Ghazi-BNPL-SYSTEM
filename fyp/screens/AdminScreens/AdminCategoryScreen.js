import React, { useEffect, useRef, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Dimensions, Text, TextInput, RefreshControl,
  ActivityIndicator, Platform, Alert, ScrollView
} from 'react-native';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // make sure this path is correct for your setup

import Icon from 'react-native-vector-icons/FontAwesome';
import {
  FAB, Modal, Portal, Provider,
  TextInput as PaperInput, Button
} from 'react-native-paper';

const { width } = Dimensions.get('window');


export default function AdminCategoryScreen({ navigation }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);


  const [modalVisible, setModalVisible] = useState(false);
  const [editCategory, setEditCategory] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);

  // ✅ useRef-based inputs (no re-renders on typing)
  const tempNameRef = useRef('');
  const tempDescRef = useRef('');
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'Category'));
      const fetched = [];
      querySnapshot.forEach(docSnap => {
        fetched.push({ id: docSnap.id, ...docSnap.data() });
      });
      const sorted = fetched.sort((a, b) =>
        a.categoryName.localeCompare(b.categoryName)
      );
      setCategories(sorted);
      setFilteredCategories(sorted);
    } catch (error) {
      console.error('Firestore fetch failed:', error);
    } finally {
      setLoading(false);
      setHasFetched(true); // ✅ mark that we’ve finished loading once
    }
  };



  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query) {
      const filteredData = categories.filter(category =>
        category.categoryName.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredCategories(filteredData);
      setNoResults(filteredData.length === 0);
    } else {
      setFilteredCategories(categories);
      setNoResults(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setFilteredCategories(categories);
    setNoResults(false);
  };

  const openEditModal = (category) => {
    setEditCategory(category);
    tempNameRef.current = category.categoryName;
    tempDescRef.current = category.categoryDescription;
    setModalVisible(true);
    setShowEditForm(false);
  };

  const openAddModal = () => {
    setEditCategory(null);
    tempNameRef.current = '';
    tempDescRef.current = '';
    setModalVisible(true);
    setShowEditForm(true);
  };

  const handleAddOrEditCategory = async () => {
    const name = tempNameRef.current.trim();
    const desc = tempDescRef.current.trim();
    if (!name) return;

    // ❌ Check for duplicate names (case-insensitive)
    const isDuplicate = categories.some(cat =>
      cat.categoryName.toLowerCase() === name.toLowerCase() &&
      (!editCategory || cat.id !== editCategory.id) // ignore self if editing
    );

    if (isDuplicate) {
      Alert.alert('Duplicate Category', 'A category with this name already exists.');
      return;
    }

    setSaving(true);
    try {
      if (editCategory) {
        const categoryRef = doc(db, 'Category', editCategory.id);
        await updateDoc(categoryRef, {
          categoryName: name,
          categoryDescription: desc,
        });
      } else {
        await addDoc(collection(db, 'Category'), {
          categoryName: name,
          categoryDescription: desc,
        });
      }

      await fetchCategories();
      setModalVisible(false);
      setEditCategory(null);
      setShowEditForm(false);
      tempNameRef.current = '';
      tempDescRef.current = '';
    } catch (error) {
      console.error('Error saving category:', error);
    } finally {
      setSaving(false);
    }
  };


  const handleDelete = async (id) => {
    Alert.alert("Delete Category", "Are you sure you want to delete this category?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteDoc(doc(db, 'Category', id));
            await fetchCategories();
            setModalVisible(false);
          } catch (error) {
            console.error('Error deleting category:', error);
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };


  return (
    <Provider>
      <View style={styles.container}>
        <View style={styles.headerBg}>
          <View style={styles.searchBar}>
            <Icon name="search" size={18} color="#FF0000" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search categories..."
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch}>
                <Icon name="times" size={18} color="#FF0000" />
              </TouchableOpacity>
            )}
          </View>
        </View>

     

        {loading ? (
          <ActivityIndicator size="large" color="#FF0000" style={styles.loader} />
        ) : !searchQuery && categories.length === 0 && hasFetched ? (
          <Text style={styles.noResultsText}>No categories available.</Text>
        ) : filteredCategories.length === 0 && searchQuery ? (
          <Text style={styles.noResultsText}>No categories match your search.</Text>
        ) : (
          <FlatList
            data={filteredCategories}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.categoryItem} onPress={() => openEditModal(item)}>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryText}>{item.categoryName}</Text>
                  <Text style={styles.categoryDescription}>{item.categoryDescription}</Text>
                </View>
                <Icon name="chevron-right" size={15} color="#FF0000" />
              </TouchableOpacity>
            )}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchCategories} />}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}


        <FAB
          style={[styles.fab, { right: 16 }]}
          icon="plus" color='white' size='30'
          onPress={openAddModal}
        />

        <Portal>
          <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modal}>
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{editCategory ? 'Category Options' : 'Add New Category'}</Text>

              <PaperInput
                label="Category Name"
                defaultValue={tempNameRef.current}
                onChangeText={(text) => tempNameRef.current = text}
                mode="outlined"
                style={{ marginBottom: 10 }}
                outlineColor="#bbb"
                activeOutlineColor="#000"
                disabled={editCategory && !showEditForm}
                textColor={editCategory && !showEditForm ? '#444' : '#000'}
              />
              <PaperInput
                label="Category Description"
                defaultValue={tempDescRef.current}
                onChangeText={(text) => tempDescRef.current = text}
                mode="outlined"
                style={{ marginBottom: 20 }}
                outlineColor="#bbb"
                activeOutlineColor="#000"
                disabled={editCategory && !showEditForm}
                textColor={editCategory && !showEditForm ? '#444' : '#000'}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                {editCategory && !showEditForm ? (
                  <>
                    <Button onPress={() => setShowEditForm(true)} mode="outlined" textColor="#FF0000" style={{ flex: 1, marginRight: 5 }}>Edit</Button>
                    <Button
                      onPress={() => handleDelete(editCategory.id)}
                      mode="outlined"
                      textColor="red"
                      style={{ flex: 1, marginLeft: 5 }}
                      loading={deleting}
                      disabled={deleting}
                    >
                      Delete
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onPress={() => setModalVisible(false)} mode="outlined" textColor="#FF0000" style={{ flex: 1, marginRight: 5 }}>Cancel</Button>
                    <Button
                      mode="contained"
                      onPress={handleAddOrEditCategory}
                      style={{ backgroundColor: '#FF0000', flex: 1, marginLeft: 5 }}
                      loading={saving}
                      disabled={saving}
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
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 0,
    backgroundColor: '#f7f7f7',
  },
  headerBg: {
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 10,
    paddingHorizontal: 15,
    backgroundColor: '#f7f7f7'
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 50,
    paddingHorizontal: 15,
    paddingVertical: 5,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#333',
  },
  noResultsText: {
    fontSize: width < 375 ? 16 : 20,
    color: "#ff0000",
    textAlign: "center",
    marginBottom: 10,
    fontWeight: 'bold'
  },
  loader: {
    marginTop: 20,
  },
  categoryItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryText: {
    fontSize: width < 375 ? 16 : 18,
    fontWeight: 'bold',
    color: '#0055a5',
  },
  categoryDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  separator: {
    height: 0,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    backgroundColor: '#FF0000',
  },
  modal: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginHorizontal: 20,
    maxHeight: Dimensions.get('window').height * 0.8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
});
