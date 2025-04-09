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