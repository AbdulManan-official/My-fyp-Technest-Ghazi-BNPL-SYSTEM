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

  const planNameRef = useRef(planData.planName || '');
  const durationRef = useRef(planData.duration || '');
  const interestRateRef = useRef(planData.interestRate || '');
  const penaltyRef = useRef(planData.penalty || '');

  const handleChange = (field, value) => {
    setPlanData(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    if (!editMode) {
      setPlanData(prev => ({ ...prev, planType: 'Installment', paymentType: null }));
    }
  }, [editMode]);

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

  return (
    <View>
      <Text style={styles.modalTitle}>{editMode ? 'Plan Options' : 'Add BNPL Plan'}</Text>

      <PaperInput
        label="Plan Name"
        mode="outlined"
        defaultValue={planData.planName || ''}
        onChangeText={(text) => {
          planNameRef.current = text;
          handleChange('planName', text);
        }}
        style={styles.input}
        outlineColor="#bbb"
        activeOutlineColor="#000"
        disabled={editMode && !showEditForm}
        textColor={editMode && !showEditForm ? '#444' : '#000'}
      />

      <Text style={styles.label}>Select Plan Type:</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={planData.planType}
          onValueChange={(val) => handleChange('planType', val)}
          enabled={!editMode || showEditForm}
        >
          <Picker.Item label="Fixed Duration" value="Fixed Duration" />
          <Picker.Item label="Installment" value="Installment" />
        </Picker>
      </View>

      <PaperInput
        label="Duration (months)"
        mode="outlined"
        keyboardType="numeric"
        defaultValue={planData.duration || ''}
        onChangeText={(text) => {
          durationRef.current = text;
          handleChange('duration', text);
        }}
        style={styles.input}
        outlineColor="#bbb"
        activeOutlineColor="#000"
        disabled={editMode && !showEditForm}
        textColor={editMode && !showEditForm ? '#444' : '#000'}
      />

      {planData.planType === 'Installment' && (
        <>
          <PaperInput
            label="Interest Rate (%)"
            mode="outlined"
            keyboardType="numeric"
            defaultValue={planData.interestRate || ''}
            onChangeText={(text) => {
              interestRateRef.current = text;
              handleChange('interestRate', text);
            }}
            style={styles.input}
            outlineColor="#bbb"
            activeOutlineColor="#000"
            disabled={editMode && !showEditForm}
            textColor={editMode && !showEditForm ? '#444' : '#000'}
          />
          <PaperInput
            label="Penalty on Delay (PKR) - Optional"
            mode="outlined"
            keyboardType="numeric"
            defaultValue={planData.penalty || ''}
            onChangeText={(text) => {
              penaltyRef.current = text;
              handleChange('penalty', text);
            }}
            style={styles.input}
            outlineColor="#bbb"
            activeOutlineColor="#000"
            disabled={editMode && !showEditForm}
            textColor={editMode && !showEditForm ? '#444' : '#000'}
          />
        </>
      )}

      {planData.planType === 'Fixed Duration' && (
        <>
          <Text style={styles.label}>Payment Type:</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={planData.paymentType}
              onValueChange={(val) => handleChange('paymentType', val)}
              enabled={false}
            >
              <Picker.Item label="One-time payment" value="One-time payment" />
            </Picker>
          </View>
        </>
      )}

      <View style={styles.buttonRow}>
        {editMode && !showEditForm ? (
          <>
            <Button
              mode="outlined"
              onPress={() => setShowEditForm(true)}
              textColor="#FF0000"
              style={{ flex: 1, marginRight: 5 }}
            >
              Edit
            </Button>
            <Button
              mode="outlined"
              onPress={handleDelete}
              loading={localDeleting}
              disabled={localDeleting}
              textColor="red"
              style={{ flex: 1, marginLeft: 5 }}
            >
              Delete
            </Button>
          </>
        ) : (
          <>
            <Button
              mode="outlined"
              onPress={onCancel}
              textColor="#FF0000"
              style={{ flex: 1, marginRight: 5 }}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={onSave}
              loading={saving}
              disabled={saving}
              style={{ flex: 1, marginLeft: 5, backgroundColor: '#FF0000' }}
            >
              {editMode ? 'Update' : 'Save'}
            </Button>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    marginBottom: 10,
  },
  pickerWrapper: {
    borderWidth: 1.5,
    borderColor: '#bbb',
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#f1f1f1'
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 20,
  },
});
