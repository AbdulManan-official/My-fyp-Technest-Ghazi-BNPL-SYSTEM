import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';

const UserVerificationDetailScreen = ({ route, navigation }) => {
  const { user } = route.params;
  const [status, setStatus] = useState(user.verificationStatus);
  const [loadingApprove, setLoadingApprove] = useState(false);
  const [loadingReject, setLoadingReject] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const [idFrontLoading, setIdFrontLoading] = useState(true);
  const [idBackLoading, setIdBackLoading] = useState(true);
  const [selfieLoading, setSelfieLoading] = useState(true);

  useEffect(() => {
    console.log('User profileImage:', user?.profileImage);
    console.log('Verification Images:', user?.verificationImages);
  }, []);

  const handleApprove = async () => {
    setLoadingApprove(true);
    try {
      const db = getFirestore();
      const userRef = doc(db, 'Users', user.id);
      await updateDoc(userRef, { verificationStatus: 'Verified' });

      Alert.alert('Approved', 'User verification has been approved.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      setStatus('Verified');
    } catch (error) {
      console.error("Error approving user:", error);
      Alert.alert('Error', 'Something went wrong while approving the user.');
    } finally {
      setLoadingApprove(false);
    }
  };

  const handleReject = async () => {
    setLoadingReject(true);
    try {
      const db = getFirestore();
      const userRef = doc(db, 'Users', user.id);
      await updateDoc(userRef, { verificationStatus: 'Rejected' });

      Alert.alert('Rejected', 'User verification has been rejected.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      setStatus('Rejected');
    } catch (error) {
      console.error("Error rejecting user:", error);
      Alert.alert('Error', 'Something went wrong while rejecting the user.');
    } finally {
      setLoadingReject(false);
    }
  };

  const openImagePreview = (imageUri) => {
    setSelectedImage(imageUri);
    setModalVisible(true);
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollViewContainer}>
      {/* User Info */}
      <View style={styles.userInfo}>
        {user.profileImage ? (
          <Image source={{ uri: user.profileImage }} style={styles.profileImage} />
        ) : (
          <View style={styles.defaultProfileImage}>
            <Icon name="user" size={30} color="red" />
          </View>
        )}
        <View>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>Email: {user.email}</Text>
          <Text style={styles.userPhone}>Phone: {user.phone}</Text>
          <Text style={styles.userAddress}>Address: {user.address || "Address not available"}</Text>
          <Text style={[
            styles.status,
            status === 'Verified' ? styles.approved :
            status === 'Rejected' ? styles.rejected : styles.pending
          ]}>
            {status}
          </Text>
        </View>
      </View>

      {/* Verification Images */}
      {user.verificationImages?.idFront ? (
        <TouchableOpacity onPress={() => openImagePreview(user.verificationImages.idFront)}>
          <View style={{ position: 'relative' }}>
            {idFrontLoading && <ActivityIndicator style={styles.imageLoader} size="large" color="#888" />}
            <Image
              source={{ uri: user.verificationImages.idFront }}
              style={[styles.documentImage, idFrontLoading && { opacity: 0.3 }]}
              onLoadEnd={() => setIdFrontLoading(false)}
            />
          </View>
        </TouchableOpacity>
      ) : (
        <Text style={styles.noImageText}>Front ID not uploaded</Text>
      )}

      {user.verificationImages?.idBack ? (
        <TouchableOpacity onPress={() => openImagePreview(user.verificationImages.idBack)}>
          <View style={{ position: 'relative' }}>
            {idBackLoading && <ActivityIndicator style={styles.imageLoader} size="large" color="#888" />}
            <Image
              source={{ uri: user.verificationImages.idBack }}
              style={[styles.documentImage, idBackLoading && { opacity: 0.3 }]}
              onLoadEnd={() => setIdBackLoading(false)}
            />
          </View>
        </TouchableOpacity>
      ) : (
        <Text style={styles.noImageText}>Back ID not uploaded</Text>
      )}

      {user.verificationImages?.selfie ? (
        <TouchableOpacity onPress={() => openImagePreview(user.verificationImages.selfie)}>
          <View style={{ position: 'relative' }}>
            {selfieLoading && <ActivityIndicator style={styles.imageLoader} size="large" color="#888" />}
            <Image
              source={{ uri: user.verificationImages.selfie }}
              style={[styles.documentImage, selfieLoading && { opacity: 0.3 }]}
              onLoadEnd={() => setSelfieLoading(false)}
            />
          </View>
        </TouchableOpacity>
      ) : (
        <Text style={styles.noImageText}>Selfie not uploaded</Text>
      )}

      {/* Action Buttons */}
      {status === 'Pending' && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleApprove}
            style={[styles.button, styles.approveButton]}
            disabled={loadingApprove}
          >
            {loadingApprove ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Icon name="check" size={16} color="#FFF" />
                <Text style={styles.buttonText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleReject}
            style={[styles.button, styles.rejectButton]}
            disabled={loadingReject}
          >
            {loadingReject ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Icon name="times" size={16} color="#FFF" />
                <Text style={styles.buttonText}>Reject</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Image Preview Modal */}
      <Modal visible={modalVisible} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setModalVisible(false)}>
            <Icon name="times-circle" size={30} color="#FFF" />
          </TouchableOpacity>
          <Image source={{ uri: selectedImage }} style={styles.previewImage} />
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollViewContainer: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 60,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginRight: 15,
  },
  defaultProfileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 15,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  userEmail: { fontSize: 16, color: '#555' },
  userPhone: { fontSize: 16, color: '#555' },
  userAddress: { fontSize: 16, color: '#555' },
  status: { fontSize: 16, fontWeight: 'bold', marginTop: 3 },
  approved: { color: 'green' },
  rejected: { color: 'red' },
  pending: { color: 'red' },
  documentImage: { width: '100%', height: 220, borderRadius: 10, marginVertical: 10 },
  imageLoader: { position: 'absolute', top: '45%', left: '45%', zIndex: 1 },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
  },
  approveButton: { backgroundColor: 'green' },
  rejectButton: { backgroundColor: 'red' },
  buttonText: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginLeft: 5 },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: { width: '90%', height: '80%', resizeMode: 'contain' },
  modalClose: { position: 'absolute', top: 40, right: 20 },
  noImageText: {
    color: 'gray',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 5,
  },
});

export default UserVerificationDetailScreen;
