import React, { useEffect, useState, useCallback } from 'react'; // Import useCallback
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Dimensions, Text, TextInput, RefreshControl,
  ActivityIndicator, Platform, SafeAreaView, Alert
} from 'react-native';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  query, orderBy, onSnapshot // --- CHANGED: Import onSnapshot ---
} from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // Ensure this path is correct
import Icon from 'react-native-vector-icons/FontAwesome';
import {
  FAB, Modal, Portal, Provider,
} from 'react-native-paper';
import BNPLPlanForm from '../../Components/BNPLPlansForm'; // Ensure this path is correct

const { width, height } = Dimensions.get('window');

export default function BNPLPlansScreen() {
  const [plans, setPlans] = useState([]);
  const [filteredPlans, setFilteredPlans] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [saving, setSaving] = useState(false);

  const initialPlanData = {
    planName: '',
    planType: null,
    duration: '',
    interestRate: '',
    paymentType: null,
    status: true,
  };

  const [planData, setPlanData] = useState(initialPlanData);

  // --- CHANGED: useEffect now sets up the real-time listener ---
  useEffect(() => {
    setLoading(true);
    const plansQuery = query(collection(db, 'BNPL_plans'), orderBy('planName'));

    // onSnapshot returns an 'unsubscribe' function.
    const unsubscribe = onSnapshot(plansQuery, (querySnapshot) => {
      const fetched = [];
      querySnapshot.forEach(docSnap => {
        fetched.push({ id: docSnap.id, ...docSnap.data() });
      });
      
      setPlans(fetched); // Update the master list of plans

      // Turn off loading indicators after the first fetch
      if (loading) setLoading(false);
      if (!hasFetched) setHasFetched(true);

    }, (error) => {
      console.error('Failed to listen for plan updates:', error);
      Alert.alert("Error", "Could not fetch plans in real-time.");
      setLoading(false);
    });

    // --- NEW: Cleanup function to unsubscribe when the component unmounts ---
    // This is crucial to prevent memory leaks.
    return () => unsubscribe();
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once to set up the listener.


  // --- NEW: A separate useEffect to handle filtering ---
  // This runs whenever the master 'plans' list or the 'searchQuery' changes.
  // This is better than filtering inside the snapshot listener.
  useEffect(() => {
    if (searchQuery) {
      const lowerCaseQuery = searchQuery.toLowerCase();
      const filtered = plans.filter(p =>
        p.planName.toLowerCase().includes(lowerCaseQuery) ||
        (p.planType && p.planType.toLowerCase().includes(lowerCaseQuery))
      );
      setFilteredPlans(filtered);
    } else {
      setFilteredPlans(plans); // If no search query, show all plans
    }
  }, [searchQuery, plans]); // It depends on both search query and the plans list


  // --- CHANGED: onRefresh is now simpler ---
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Data is already live, so we just give the user visual feedback.
    // The listener in the background ensures data is up-to-date.
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // --- CHANGED: handleSearch now only updates the state ---
  const handleSearch = (query) => {
    setSearchQuery(query);
  };
  
  const clearSearch = () => {
    setSearchQuery('');
  };

  // The open/close modal functions remain the same
  const openEditModal = (plan) => {
    setEditPlan(plan);
    setPlanData({
      planName: plan.planName || '',
      planType: plan.planType || null,
      duration: plan.duration?.toString() || '',
      interestRate: plan.interestRate !== null && plan.interestRate !== undefined
                       ? plan.interestRate.toString()
                       : '',
      paymentType: plan.paymentType || null,
      status: plan.status === 'Published',
    });
    setModalVisible(true);
  };
  
  const openAddModal = () => {
    setEditPlan(null);
    setPlanData(initialPlanData);
    setModalVisible(true);
  };
  
  const closeModal = () => {
    setModalVisible(false);
    setEditPlan(null);
    setPlanData(initialPlanData);
    setSaving(false);
  };

  // --- CHANGED: handleSave no longer needs to manually refetch data ---
  const handleSave = async () => {
    // Validation remains the same
    const { planName, planType, duration, interestRate, paymentType, status } = planData;
    if (!planName || !duration || !planType) {
      return Alert.alert('Validation Error', 'Please provide Plan Name, Duration, and Plan Type.');
    }
    // ... other validations ...
    const isDuplicate = plans.some(p =>
      p.planName.toLowerCase() === planName.trim().toLowerCase() && (!editPlan || p.id !== editPlan.id)
    );
    if (isDuplicate) {
      return Alert.alert('Duplicate Plan', 'A plan with this name already exists.');
    }
    
    setSaving(true);
    try {
      const payload = {
        planName: planName.trim(),
        planType,
        duration: Number(duration),
        interestRate: (planType === 'Installment' || planType === 'Fixed Duration') && interestRate.trim() !== ''
                      ? Number(interestRate)
                      : null,
        paymentType: planType === 'Fixed Duration' ? 'One-time payment' : (planType === 'Installment' ? paymentType : null),
        status: status ? 'Published' : 'Draft',
        updatedAt: new Date(),
        ...( !editPlan && { createdAt: new Date() } )
      };

      if (editPlan) {
        await updateDoc(doc(db, 'BNPL_plans', editPlan.id), payload);
      } else {
        await addDoc(collection(db, 'BNPL_plans'), payload);
      }
      
      // await fetchPlans(); // --- REMOVED: No longer needed! The listener handles it.
      
      closeModal();
    } catch (err) {
      console.error('Error saving plan:', err);
      Alert.alert('Save Error', 'Could not save the plan. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // --- CHANGED: handleDeleteFromForm no longer needs to manually refetch data ---
  // const handleDeleteFromForm = async (docId) => {
  //    if (!docId) return;
  //   Alert.alert(
  //     "Confirm Deletion",
  //     "Are you sure you want to delete this plan?",
  //     [
  //       { text: "Cancel", style: "cancel" },
  //       {
  //         text: "Delete",
  //         style: "destructive",
  //         onPress: async () => {
  //           try {
  //               await deleteDoc(doc(db, 'BNPL_plans', docId));
  //               // await fetchPlans(); // --- REMOVED: No longer needed! The listener handles it.
  //               closeModal();
  //           } catch (error) {
  //               console.error('Error deleting plan from modal:', error);
  //               Alert.alert('Delete Error', 'Could not delete the plan.');
  //           }
  //         }
  //       }
  //     ]
  //   );
  // };
  
  // --- The rest of the component (render helpers and JSX) remains the same ---
  // --- It will now automatically re-render when the state updates from the listener. ---
  
  const renderPlanItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => openEditModal(item)}>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.planName} numberOfLines={1} ellipsizeMode="tail">{item.planName}</Text>
        </View>
        <Text style={styles.planDetail}>Type: {item.planType || 'N/A'}</Text>
        <Text style={styles.planDetail}>Duration: {item.duration ? `${item.duration} months` : 'N/A'}</Text>
        <Text style={styles.planDetail}>
          Interest: {item.interestRate !== null && item.interestRate !== undefined ? `${item.interestRate}%` : 'N/A'}
        </Text>
      </View>
      <View style={[styles.statusBadge, item.status === 'Published' ? styles.statusPublished : styles.statusDraft]}>
        <Text style={[styles.statusText, item.status === 'Draft' && styles.statusDraftText]}>
          {item.status || 'Unknown'}
        </Text>
      </View>
      <Icon name="chevron-right" size={16} color="black" style={styles.chevronIcon} />
    </TouchableOpacity>
  );

  const renderListEmptyComponent = () => {
    // ... (This logic remains the same)
    if (loading && !hasFetched) {
      return (
        <View style={styles.emptyListContainer}>
          <ActivityIndicator size="large" color="#FF0000" />
          <Text style={styles.emptyListText}>Loading Plans...</Text>
        </View>
      );
    }
    if (hasFetched) {
        if (searchQuery && filteredPlans.length === 0) {
        return (
            <View style={styles.emptyListContainer}>
            <Icon name="search" size={40} color="#CCCCCC" />
            <Text style={styles.emptyListText}>No plans match "{searchQuery}"</Text>
            </View>
        );
        }
        if (!searchQuery && plans.length === 0) {
        return (
            <View style={styles.emptyListContainer}>
            <Icon name="list-alt" size={40} color="#CCCCCC" />
            <Text style={styles.emptyListText}>No BNPL plans found.</Text>
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
          <View style={styles.header}>
            <View style={styles.searchBarContainer}>
              <Icon name="search" size={18} color="black" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by Name or Type..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={handleSearch} // --- CHANGED: Using simplified function
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && Platform.OS === 'android' && (
                <TouchableOpacity onPress={clearSearch} style={styles.clearSearchButton}>
                  <Icon name="times-circle" size={18} color="black" />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <FlatList
            data={filteredPlans}
            keyExtractor={(item) => item.id}
            renderItem={renderPlanItem}
            contentContainerStyle={styles.listContentContainer}
            ListEmptyComponent={renderListEmptyComponent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#FF0000"]}
                tintColor={"#FF0000"}
              />
            }
          />
          <FAB
             style={styles.fab}
             icon="plus"
             color="white"
             onPress={openAddModal}
             accessibilityLabel="Add new BNPL Plan"
          />
          <Portal>
            <Modal
              visible={modalVisible}
              onDismiss={closeModal}
              contentContainerStyle={styles.modalContent}
              >
              <BNPLPlanForm
                planData={planData}
                setPlanData={setPlanData}
                saving={saving}
                editMode={!!editPlan}
                onSave={handleSave}
                onCancel={closeModal}
                onDeleted={closeModal}
                docId={editPlan?.id}
              />
            </Modal>
          </Portal>
        </View>
      </SafeAreaView>
    </Provider>
  );
}

// --- Styles remain unchanged ---
const styles = StyleSheet.create({
  // ... (all your styles are perfect as they are)
   safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? 15 : 10,
    paddingBottom: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
 searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFEFEF',
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
  listContentContainer: {
    paddingBottom: 90,
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginRight: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333333',
    flexShrink: 1,
    marginRight: 8,
  },
  planDetail: {
    fontSize: 14,
    color: '#666666',
    marginTop: 5,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 15,
    marginRight: 10,
  },
  statusPublished: {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
  },
  statusDraft: {
    backgroundColor: 'rgba(150, 150, 150, 0.15)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: 'rgba(255, 0, 0, 0.9)',
  },
  statusDraftText: {
    color: '#666666',
  },
  chevronIcon: {
    color:'black'
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    marginTop: height * 0.1,
    backgroundColor: '#FFFFFF',
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
  fab: {
    position: 'absolute',
    margin: 16,
    right: 10,
    bottom: 20,
    backgroundColor: '#FF0000',
     elevation: 6,
     shadowColor: '#000',
     shadowOffset: { width: 0, height: 4 },
     shadowOpacity: 0.3,
     shadowRadius: 4,
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 25,
    borderRadius: 15,
    marginHorizontal: 15,
    maxHeight: height * 0.85,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
});