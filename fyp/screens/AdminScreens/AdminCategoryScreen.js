import React, { useEffect, useState } from 'react';
import { 
  View, FlatList, TouchableOpacity, StyleSheet, 
  Dimensions, Text, TextInput, RefreshControl, ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { FAB } from 'react-native-paper';

const { width } = Dimensions.get('window');

const dummyCategories = [
  { id: '1', categoryName: 'Electronics', categoryDescription: 'Devices and gadgets' },
  { id: '2', categoryName: 'Fashion', categoryDescription: 'Clothing and accessories' },
  { id: '3', categoryName: 'Books', categoryDescription: 'Educational and novels' },
  { id: '4', categoryName: 'Home Decor', categoryDescription: 'Furniture and decorations' },
  { id: '5', categoryName: 'Sports', categoryDescription: 'Fitness and outdoor gear' },
];

export default function AdminCategoryScreen({ navigation }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [noResults, setNoResults] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const sorted = dummyCategories.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
      setCategories(sorted);
      setFilteredCategories(sorted);
    } catch (error) {
      console.error('Failed to fetch categories!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

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

  return (
    <View style={styles.container}>
      <View style={styles.searchBarContainer}>
        <TextInput
          style={styles.searchBar}
          placeholder="Search Categories..."
          value={searchQuery}
          onChangeText={handleSearch}
        />
        <TouchableOpacity onPress={() => handleSearch(searchQuery)} style={styles.searchButton}>
          <Icon name="search" size={20} color="#FF0000" />
        </TouchableOpacity>
        {searchQuery ? (
          <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
            <Icon name="times" size={20} color="#FF0000" />
          </TouchableOpacity>
        ) : null}
      </View>

      {noResults && (
        <Text style={styles.noResultsText}>No categories match your search.</Text>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#FF0000" style={styles.loader} />
      ) : (
        <FlatList
          data={filteredCategories}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.categoryItem} 
              onPress={() => navigation.navigate('DetailCategory', { category: item })}
            >
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryText}>{item.categoryName}</Text>
                <Text style={styles.categoryDescription}>{item.categoryDescription}</Text>
              </View>
              <Icon name="chevron-right" size={15} color="#FF0000" />
            </TouchableOpacity>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchCategories} />}
        />
      )}

      <FAB 
        style={styles.fab}
        icon="plus" color='white' size='30'
        onPress={() => navigation.navigate('CreateCategory')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: width < 375 ? 10 : 16,
    backgroundColor: '#f7f7f7',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
    width: '100%',
  },
  searchBar: {
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 30,
    paddingLeft: 15,
    flex: 1,
    fontSize: width < 375 ? 14 : 16,
    backgroundColor: '#fff',
  },
  searchButton: {
    position: "absolute",
    right: width < 375 ? 14 : 16,
    padding: 10,
  },
  clearButton: {
    position: "absolute",
    right: 48,
    padding: 10,
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
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
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
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 30,
    backgroundColor: '#FF0000',
  },
});