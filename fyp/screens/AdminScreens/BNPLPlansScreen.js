import React, { useEffect, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Dimensions, Text, TextInput, RefreshControl,
  ActivityIndicator, Platform
} from 'react-native';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import Icon from 'react-native-vector-icons/FontAwesome';
import {
  FAB, Modal, Portal, Provider,
  Button
} from 'react-native-paper';
import BNPLPlanForm from '../../Components/BNPLPlansForm';

const { width } = Dimensions.get('window');

export default function BNPLPlansScreen() {
  const [plans, setPlans] = useState([]);
  const [filteredPlans, setFilteredPlans] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [planData, setPlanData] = useState({
    planName: '',
    planType: 'Fixed Duration',
    duration: '',
    interestRate: '',
    penalty: '',
    paymentType: 'One-time payment',
    status: true,
  });

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'BNPL_plans'));
      const fetched = [];
      querySnapshot.forEach(docSnap => {
        fetched.push({ id: docSnap.id, ...docSnap.data() });
      });
      const sorted = fetched.sort((a, b) =>
        a.planName.localeCompare(b.planName)
      );
      setPlans(sorted);
      setFilteredPlans(sorted);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query) {
      const filtered = plans.filter(p =>
        p.planName.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredPlans(filtered);
    } else {
      setFilteredPlans(plans);
    }
  };

  const openEditModal = (plan) => {
    setEditPlan(plan);
    setPlanData({
      id: plan.id, // ✅ this is necessary for deletion to work
      planName: plan.planName || '',
      planType: plan.planType || 'Fixed Duration',
      duration: plan.duration?.toString() || '',
      interestRate: plan.interestRate?.toString() || '',
      penalty: plan.penalty?.toString() || '',
      paymentType: plan.paymentType || 'One-time payment',
      status: plan.status === 'Published',
    });
    
    setModalVisible(true);
  };

  const openAddModal = () => {
    setEditPlan(null);
    setPlanData({
      planName: '',
      planType: 'Fixed Duration',
      duration: '',
      interestRate: '',
      penalty: '',
      paymentType: 'One-time payment',
      status: true,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    const { planName, planType, duration, interestRate, penalty, paymentType, status } = planData;

    if (!planName || !duration || (planType === 'Installment' && (!interestRate || !penalty))) {
      return alert('Please fill all required fields');
    }

    const isDuplicate = plans.some(p =>
      p.planName.toLowerCase() === planName.toLowerCase() && (!editPlan || p.id !== editPlan.id)
    );
    if (isDuplicate) {
      return alert('Plan with this name already exists');
    }

    setSaving(true);
    try {
      const payload = {
        planName,
        planType,
        duration: Number(duration),
        interestRate: planType === 'Installment' ? Number(interestRate) : null,
        penalty: planType === 'Installment' ? Number(penalty) : null,
        paymentType: planType === 'Fixed Duration' ? paymentType : null,
        status: status ? 'Published' : 'Draft',
        createdAt: new Date(),
      };
      if (editPlan) {
        await updateDoc(doc(db, 'BNPL_plans', editPlan.id), payload);
      } else {
        await addDoc(collection(db, 'BNPL_plans'), payload);
      }
      await fetchPlans();
      setModalVisible(false);
    } catch (err) {
      console.error('Error saving plan:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    Alert.alert('Delete Plan', 'Are you sure you want to delete this plan?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setDeleting(true);
          try {
            await deleteDoc(doc(db, 'BNPL_plans', id));
            await fetchPlans();
            setModalVisible(false);
          } catch (error) {
            console.error('Error deleting plan:', error);
          } finally {
            setDeleting(false);
          }
        }
      }
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
              placeholder="Search BNPL plans..."
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="times" size={18} color="#FF0000" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#FF0000" style={styles.loader} />
        ) : !searchQuery && plans.length === 0 && hasFetched ? (
          <Text style={styles.noResultsText}>No BNPL plans available.</Text>
        ) : filteredPlans.length === 0 && searchQuery ? (
          <Text style={styles.noResultsText}>No plans match your search.</Text>
        ) : (
          <FlatList
            data={filteredPlans}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.categoryItem} onPress={() => openEditModal(item)}>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryText}>{item.planName}</Text>
                  <Text style={styles.categoryDescription}>Type: {item.planType}</Text>
                </View>
                <Icon name="chevron-right" size={15} color="#FF0000" />
              </TouchableOpacity>
            )}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchPlans} />}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}

        <FAB style={styles.fab} icon="plus" color="white" onPress={openAddModal} />

        <Portal>
          <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modal}>
          <BNPLPlanForm
  planData={planData}
  setPlanData={setPlanData}
  saving={saving}
  deleting={deleting}
  editMode={!!editPlan}
  onSave={handleSave}
  onCancel={() => setModalVisible(false)}
  onDeleted={() => {
    setModalVisible(false);
    fetchPlans(); // Refresh list
  }}
  docId={editPlan?.id} // ✅ Pass ID separately!
/>

          </Modal>
        </Portal>
      </View>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7' },
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
    right: 16,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF0000',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  
  modal: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginHorizontal: 20,
    maxHeight: Dimensions.get('window').height * 0.9,
  },
});
