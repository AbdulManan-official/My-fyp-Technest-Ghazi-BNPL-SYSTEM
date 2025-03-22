import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Dimensions, Platform, ScrollView
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const orders = [
  { id: '1', name: 'iPhone 14', status: 'Active', price: '$999' },
  { id: '2', name: 'Nike Sneakers', status: 'Active', price: '$120' },
  { id: '3', name: 'Samsung TV', status: 'Pending', price: '$499' },
  { id: '4', name: 'Laptop', status: 'Pending', price: '$899' },
  { id: '5', name: 'Coffee Maker', status: 'Delivered', price: '$79' },
  { id: '6', name: 'Headphones', status: 'Delivered', price: '$199' },
  { id: '7', name: 'AirPods Pro', status: 'Active', price: '$249' },
  { id: '8', name: 'Gaming Chair', status: 'Pending', price: '$299' },
  { id: '9', name: 'Smart Watch', status: 'Delivered', price: '$199' },
  { id: '10', name: 'Bluetooth Speaker', status: 'Active', price: '$89' },
  { id: '11', name: 'Microwave Oven', status: 'Pending', price: '$150' },
  { id: '12', name: 'Electric Kettle', status: 'Delivered', price: '$45' },
  { id: '13', name: 'Running Shoes', status: 'Active', price: '$130' },
  { id: '14', name: 'Portable Hard Drive', status: 'Pending', price: '$79' },
  { id: '15', name: 'Monitor 27"', status: 'Delivered', price: '$299' },
];

function OrderScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('All');

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = order.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (filter === 'All') return matchesSearch;
      return matchesSearch && order.status === filter;
    });
  }, [searchQuery, filter]);

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Active':
        return styles.activeBadge;
      case 'Pending':
        return styles.pendingBadge;
      case 'Delivered':
        return styles.deliveredBadge;
      default:
        return {};
    }
  };

  const renderOrder = ({ item }) => (
    <TouchableOpacity onPress={() => navigation.navigate('AdminDetailOrderScreen', { order: item })}>
      <View style={styles.orderItem}>
        <View style={styles.orderRow}>
          <Icon name="shopping-bag" size={20} color="#FF0000" style={styles.icon} />
          <View style={styles.orderInfo}>
            <Text style={styles.orderName}>{item.name}</Text>
            <Text style={styles.orderPrice}>{item.price}</Text>
          </View>
          <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#FF0000', '#FF0000']} style={styles.gradientHeader}>
        <View style={styles.searchBar}>
          <Icon name="search" size={18} color="#FF0000" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search orders..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="times" size={18} color="#FF0000" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {['All', 'Active', 'Pending', 'Delivered'].map(item => (
            <TouchableOpacity
              key={item}
              style={[styles.filterButton, filter === item && styles.activeFilter]}
              onPress={() => setFilter(item)}
            >
              <Text style={[styles.filterText, filter === item && styles.activeFilterText]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  gradientHeader: {
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 10,
    paddingHorizontal: 15,
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
  filterScroll: { marginTop: 10 },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FF0000',
    marginRight: 10,
  },
  filterText: {
    fontSize: 14,
    color: '#FF0000',
  },
  activeFilter: {
    backgroundColor: 'black',
  },
  activeFilterText: {
    color: '#FFF',
  },
  listContent: {
    paddingBottom: 5,
  },
  orderItem: {
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderInfo: {
    flex: 1,
    marginLeft: 10,
  },
  orderName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  orderPrice: {
    fontSize: 14,
    color: '#777',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 15,
  },
  statusText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  activeBadge: {
    backgroundColor: '#FF0000',
  },
  pendingBadge: {
    backgroundColor: '#FF0000',
  },
  deliveredBadge: {
    backgroundColor: '#FF0000',
  },
  icon: {
    marginRight: 5,
  },
});

export default OrderScreen;
