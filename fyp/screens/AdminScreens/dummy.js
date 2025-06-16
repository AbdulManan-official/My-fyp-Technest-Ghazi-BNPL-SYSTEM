import React, { useEffect, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Dimensions, Text, TextInput, RefreshControl,
  ActivityIndicator, Platform, SafeAreaView, Alert
} from 'react-native';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs,
  query, orderBy
} from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // Ensure this path is correct
import Icon from 'react-native-vector-icons/FontAwesome';
import {
  FAB, Modal, Portal, Provider,
  // Button, // Keep if used in Form
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

  const fetchPlans = async (isRefresh = false) => {
     if (!isRefresh) setLoading(true);
    try {
      const plansQuery = query(collection(db, 'BNPL_plans'), orderBy('planName'));
      const querySnapshot = await getDocs(plansQuery);
      const fetched = [];
      querySnapshot.forEach(docSnap => {
        fetched.push({ id: docSnap.id, ...docSnap.data() });
      });
      setPlans(fetched);
      handleSearch(searchQuery, fetched);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
      Alert.alert("Error", "Could not fetch plans.");
    } finally {
      setLoading(false);
      setHasFetched(true);
      if (isRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPlans(true);
  };

  const handleSearch = (query, currentPlans = plans) => {
    setSearchQuery(query);
    if (query) {
      const lowerCaseQuery = query.toLowerCase();
      const filtered = currentPlans.filter(p =>
        p.planName.toLowerCase().includes(lowerCaseQuery) ||
        (p.planType && p.planType.toLowerCase().includes(lowerCaseQuery))
      );
      setFilteredPlans(filtered);
    } else {
      setFilteredPlans(currentPlans);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setFilteredPlans(plans);
  };

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

  const handleSave = async () => {
    const { planName, planType, duration, interestRate, paymentType, status } = planData;

    // --- Validation ---
    if (!planName || !duration || !planType) {
      return Alert.alert('Validation Error', 'Please provide Plan Name, Duration, and Plan Type.');
    }
    if (planType === 'Installment' && (!interestRate || interestRate.trim() === '')) {
      return Alert.alert('Validation Error', 'Please provide Interest Rate for the Installment plan.');
    }
     if (planType === 'Installment' && !paymentType) {
      return Alert.alert('Validation Error', 'Please select a Payment Type for the Installment plan.');
    }
     if (planType === 'Fixed Duration' && (!interestRate || interestRate.trim() === '')) {
        return Alert.alert('Validation Error', 'Please provide Interest Rate for the Fixed Duration plan.');
     }
    // --- End Validation ---

    const isDuplicate = plans.some(p =>
      p.planName.toLowerCase() === planName.trim().toLowerCase() && (!editPlan || p.id !== editPlan.id)
    );
    if (isDuplicate) {
      return Alert.alert('Duplicate Plan', 'A plan with this name already exists.');
    }

    setSaving(true);
    try {
      // --- Payload ---
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
      // --- End Payload ---

      if (editPlan) {
        await updateDoc(doc(db, 'BNPL_plans', editPlan.id), payload);
      } else {
        await addDoc(collection(db, 'BNPL_plans'), payload);
      }
      await fetchPlans();
      closeModal();
    } catch (err) {
      console.error('Error saving plan:', err);
      Alert.alert('Save Error', 'Could not save the plan. Please try again.');
    } finally {
      setSaving(false);
    }
  };

 const handleDeleteFromForm = async (docId) => {
     if (!docId) return;

    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to delete this plan?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
                await deleteDoc(doc(db, 'BNPL_plans', docId));
                await fetchPlans();
                closeModal();
            } catch (error) {
                console.error('Error deleting plan from modal:', error);
                Alert.alert('Delete Error', 'Could not delete the plan.');
            }
          }
        }
      ]
    );
 };


  // --- Render Helper for List Items ---
  const renderPlanItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => openEditModal(item)}>
      {/* Content on the left (Name, Details) */}
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.planName} numberOfLines={1} ellipsizeMode="tail">{item.planName}</Text>
          {/* Status badge removed from here */}
        </View>

        {/* Plan Details */}
        <Text style={styles.planDetail}>Type: {item.planType || 'N/A'}</Text>
        <Text style={styles.planDetail}>Duration: {item.duration ? `${item.duration} months` : 'N/A'}</Text>
        <Text style={styles.planDetail}>
          Interest: {item.interestRate !== null && item.interestRate !== undefined ? `${item.interestRate}%` : 'N/A'}
        </Text>
      </View>

      {/* Status Badge (Before Chevron) */}
      <View style={[
        styles.statusBadge,
        item.status === 'Published' ? styles.statusPublished : styles.statusDraft
      ]}>
        <Text style={[
          styles.statusText,
          item.status === 'Draft' && styles.statusDraftText
        ]}>
          {item.status || 'Unknown'}
        </Text>
      </View>

      {/* Chevron Icon */}
      <Icon name="chevron-right" size={16} color="black" style={styles.chevronIcon} />
    </TouchableOpacity>
  );

  // --- Render Helper for Empty List / Loading ---
  const renderListEmptyComponent = () => {
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

  // --- Main Component Return ---
  return (
    <Provider>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.searchBarContainer}>
              <Icon name="search" size={18} color="black" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by Name or Type..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={(text) => handleSearch(text, plans)}
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

          {/* Content Area */}
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

          {/* FAB */}
          <FAB
             style={styles.fab}
             icon="plus"
             color="white"
             onPress={openAddModal}
             accessibilityLabel="Add new BNPL Plan"
          />

          {/* Modal */}
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
                onDeleted={handleDeleteFromForm}
                docId={editPlan?.id}
              />
            </Modal>
          </Portal>
        </View>
      </SafeAreaView>
    </Provider>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
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
  // --- MODIFIED --- Card layout
  card: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    flexDirection: 'row', // Arrange content, badge, chevron horizontally
    alignItems: 'center', // Align items vertically in the center
  },
  // --- MODIFIED --- Main content takes available space
  cardContent: {
    flex: 1, // Takes up space, pushing badge/chevron to the right
    marginRight: 10, // Add space between content and the status badge
  },
  // --- MODIFIED --- Back to original state (no justification)
  cardHeader: {
    flexDirection: 'row',
    // justifyContent: 'space-between', // Removed
    alignItems: 'center',
    marginBottom: 8,
  },
  // --- MODIFIED --- Back to original state (allows shrinking)
  planName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333333',
    flexShrink: 1, // Allow text to shrink if needed
    marginRight: 8, // Space if something were next to it (like original badge)
  },
  planDetail: {
    fontSize: 14,
    color: '#666666',
    marginTop: 5,
  },
  // --- MODIFIED --- Style for the badge itself
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 15,
    marginRight: 10, // Add space between badge and chevron icon
    // marginLeft: 'auto', // Removed
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
  // --- UNCHANGED --- Chevron icon style
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



import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Button, TextInput as PaperInput } from 'react-native-paper';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function BNPLPlansForm({
  planData,
  setPlanData,
  saving,
  deleting,
  editMode,
  onSave,
  onCancel,
  onDeleted,
  docId
}) {
  const [showEditForm, setShowEditForm] = useState(!editMode);
  const [localDeleting, setLocalDeleting] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const planNameRef = useRef(planData.planName || '');
  const durationRef = useRef(planData.duration || '');
  const interestRateRef = useRef(planData.interestRate || '');

  const handleChange = (field, value) => {
    setPlanData(prev => ({ ...prev, [field]: value }));
  };

  // --- Updated useEffect to manage paymentType based on planType ---
  useEffect(() => {
    if (planData.planType === 'Fixed Duration') {
      // Ensure paymentType is 'One-time payment' for Fixed Duration
      if (planData.paymentType !== 'One-time payment') {
        handleChange('paymentType', 'One-time payment');
      }
    } else if (planData.planType === 'Installment') {
      // **CHANGED**: Default paymentType to 'Monthly' for Installment
      // Only update if it's not already 'Monthly' to avoid infinite loops
      if (planData.paymentType !== 'Monthly') {
        handleChange('paymentType', 'Monthly');
      }
    } else {
      // Clear paymentType if planType is null or something else
      if (planData.paymentType !== null) {
          handleChange('paymentType', null);
      }
    }

    // Optional: Default planType on initial add if not set
    // if (!editMode && !planData.planType) {
    //   handleChange('planType', 'Installment'); // This would trigger the above logic to set paymentType
    // }

  }, [planData.planType, editMode]); // Rerun if planType or editMode changes


  const handleDelete = async () => {
    Alert.alert("Delete Plan", "Are you sure you want to delete this plan?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setLocalDeleting(true);
          try {
            await deleteDoc(doc(db, 'BNPL_plans', docId));
            onDeleted();
          } catch (error) {
            console.error('Error deleting plan:', error);
          } finally {
            setLocalDeleting(false);
          }
        },
      },
    ]);
  };

  const handleFocus = (field) => {
    setFocusedField(field);
  };

  const handleBlur = () => {
    setFocusedField(null);
  };

  // --- Validation Logic (No changes needed here for this request) ---
  const validateForm = () => {
    if (!planData.planName || !planData.duration || !planData.planType) {
      Alert.alert('Missing Fields', 'Please provide Plan Name, Duration, and Plan Type.');
      return false;
    }
    if (planData.planType === 'Installment') {
      if (!planData.interestRate) {
        Alert.alert('Missing Fields', 'Please provide Interest Rate for the Installment plan.');
        return false;
      }
      // Payment type check is still valid, as 'Monthly' should always be set now
      if (!planData.paymentType) {
         // This condition might technically be unreachable now if state is managed correctly
        Alert.alert('Missing Fields', 'Payment Type is required for Installment plan.');
        return false;
      }
    }
    // Add validation for Fixed Duration Interest Rate if needed
    // ...
    return true;
  };


  return (
    <View>
      <Text style={styles.modalTitle}>{editMode ? 'Plan Options' : 'Add BNPL Plan'}</Text>

      {/* Plan Name */}
      <PaperInput
        label="Plan Name"
        mode="outlined"
        defaultValue={planData.planName || ''}
        onChangeText={(text) => { planNameRef.current = text; handleChange('planName', text); }}
        style={styles.input}
        outlineColor="black"
        activeOutlineColor={focusedField === 'planName' ? '#FF0000' : '#FF0000'}
        disabled={editMode && !showEditForm}
        textColor={editMode && !showEditForm ? '#000' : '#000'}
        onFocus={() => handleFocus('planName')}
        onBlur={handleBlur}
      />

      {/* Plan Type Picker */}
      <Text style={styles.label}>Select Plan Type:</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={planData.planType}
          // --- Updated onValueChange to default Installment Payment to Monthly ---
          onValueChange={(val) => {
            handleChange('planType', val);
            if (val === 'Fixed Duration') {
              handleChange('paymentType', 'One-time payment');
            } else if (val === 'Installment') {
              // **CHANGED**: Set payment type directly to Monthly
              handleChange('paymentType', 'Monthly');
            } else {
               handleChange('paymentType', null);
            }
            // Optional: Clear interest rate?
            // handleChange('interestRate', '');
          }}
          enabled={!editMode || showEditForm}
        >
          <Picker.Item label="-- Select Type --" value={null} enabled={false} style={{color: 'grey'}}/>
          <Picker.Item label="Fixed Duration" value="Fixed Duration" />
          <Picker.Item label="Installment" value="Installment" />
        </Picker>
      </View>

      {/* Duration */}
      <PaperInput
        label="Duration (months)"
        mode="outlined"
        keyboardType="numeric"
        defaultValue={planData.duration || ''}
        onChangeText={(text) => { durationRef.current = text; handleChange('duration', text); }}
        style={styles.input}
        outlineColor="black"
        activeOutlineColor={focusedField === 'duration' ? '#FF0000' : '#FF0000'}
        disabled={editMode && !showEditForm}
        textColor={editMode && !showEditForm ? '#000' : '#000'}
        onFocus={() => handleFocus('duration')}
        onBlur={handleBlur}
      />

      {/* --- Fields for Installment Plan --- */}
      {planData.planType === 'Installment' && (
        <>
          {/* Interest Rate for Installment */}
          <PaperInput
            label="Interest Rate (%)"
            mode="outlined"
            keyboardType="numeric"
            defaultValue={planData.interestRate || ''}
            onChangeText={(text) => { interestRateRef.current = text; handleChange('interestRate', text); }}
            style={styles.input}
            outlineColor="black"
            activeOutlineColor={focusedField === 'interestRate' ? '#FF0000' : '#FF0000'}
            disabled={editMode && !showEditForm}
            textColor={editMode && !showEditForm ? '#000' : '#000'}
            onFocus={() => handleFocus('interestRate')}
            onBlur={handleBlur}
          />

          {/* --- Payment Type Picker for Installment (Defaults to Monthly) --- */}
          <Text style={styles.label}>Payment Type:</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              // selectedValue will now be 'Monthly' by default via state logic
              selectedValue={planData.paymentType || 'Monthly'}
              // Since 'Monthly' is the only option, changing it isn't possible,
              // but keep handler in case more options are added later.
              onValueChange={(val) => handleChange('paymentType', val)}
              // Can potentially disable this picker if Monthly is the *only* ever option
              // enabled={false} // Uncomment if Monthly should be displayed but not changeable
              enabled={!editMode || showEditForm} // Keep enabled if other options might exist or for consistency
              style={!(!editMode || showEditForm) ? styles.disabledPicker : null} // Optional disabled styling
            >
              {/* --- CHANGED: Only Monthly option --- */}
              <Picker.Item label="Monthly" value="Monthly" />
              {/* Removed Weekly and Placeholder */}
              {/* <Picker.Item label="Weekly" value="Weekly" /> */}
            </Picker>
          </View>
          {/* --- End Payment Type Picker --- */}
        </>
      )}

      {/* --- Fields for Fixed Duration Plan --- */}
      {planData.planType === 'Fixed Duration' && (
        <>
          {/* Interest Rate for Fixed Duration */}
          <PaperInput
            label="Interest Rate (%)"
            mode="outlined"
            keyboardType="numeric"
            defaultValue={planData.interestRate || ''}
            onChangeText={(text) => { interestRateRef.current = text; handleChange('interestRate', text); }}
            style={styles.input}
            outlineColor="black"
            activeOutlineColor={focusedField === 'interestRate' ? '#FF0000' : '#FF0000'}
            disabled={editMode && !showEditForm}
            textColor={editMode && !showEditForm ? '#000' : '#000'}
            onFocus={() => handleFocus('interestRate')}
            onBlur={handleBlur}
          />

          {/* Payment Type Display for Fixed Duration (Disabled) */}
          <Text style={styles.label}>Payment Type:</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={planData.paymentType || 'One-time payment'}
              enabled={false}
              style={styles.disabledPicker}
            >
              <Picker.Item label="One-time payment" value="One-time payment" />
            </Picker>
          </View>
        </>
      )}

      {/* Button Row */}
      <View style={styles.buttonRow}>
        {editMode && !showEditForm ? (
          <>
            <Button mode="outlined" onPress={() => setShowEditForm(true)} textColor="#FF0000" style={{ flex: 1, marginRight: 5 }}>Edit</Button>
            <Button mode="outlined" onPress={handleDelete} loading={localDeleting} disabled={localDeleting} textColor="red" style={{ flex: 1, marginLeft: 5 }}>Delete</Button>
          </>
        ) : (
          <>
            <Button mode="outlined" onPress={onCancel} textColor="#FF0000" style={{ flex: 1, marginRight: 5 }}>Cancel</Button>
            <Button mode="contained" onPress={() => { if (validateForm()) { onSave(); } }} loading={saving} disabled={saving} style={{ flex: 1, marginLeft: 5, backgroundColor: '#FF0000' }}>{editMode ? 'Update' : 'Save'}</Button>
          </>
        )}
      </View>
    </View>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
    input: {
      marginBottom: 10,
    },
    pickerWrapper: {
      borderWidth: 1.5,
      borderColor: '#bbb',
      borderRadius: 8,
      marginBottom: 10,
      backgroundColor: '#f1f1f1',
    },
    disabledPicker: {
       backgroundColor: '#e9e9e9', // Example: Slightly different background for disabled
       // Note: Styling the Picker directly might have limitations.
       // For text color, you might need to style the Picker.Item or use conditional styling on the View.
    },
    label: {
      fontWeight: 'bold',
      marginBottom: 5,
      fontSize: 14,
      color: '#333'
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 15,
      textAlign: 'center',
    },
    buttonRow: {
      flexDirection: 'row',
      marginTop: 20,
    },
});