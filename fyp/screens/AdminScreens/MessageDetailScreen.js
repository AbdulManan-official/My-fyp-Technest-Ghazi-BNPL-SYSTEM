import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function MessageDetailScreen({ route }) {
  const { userName, userImage } = route.params;
  const navigation = useNavigation();

  const [messages, setMessages] = useState([
    { id: '1', text: 'Hi there!', sender: 'user' },
    { id: '2', text: 'Hello! How can I help you?', sender: 'admin' },
  ]);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef(null);

  const sendMessage = () => {
    if (inputText.trim() === '') return;

    const newMessage = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText('');

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const renderMessage = ({ item }) => {
    const isUser = item.sender === 'user';
    return (
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.adminBubble,
        ]}
      >
        <Text style={styles.messageText}>{item.text}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Image source={{ uri: userImage }} style={styles.avatar} />
        <Text style={styles.name}>{userName}</Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          placeholder="Type a message..."
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF', // keep chat bg white for readability
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 15,
    paddingHorizontal: 15,
    backgroundColor: '#FF0000',
  },
  backButton: {
    marginRight: 10,
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#fff',
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  messagesContainer: {
    padding: 15,
    paddingBottom: 90,
  },
  messageBubble: {
    maxWidth: '70%',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  userBubble: {
    backgroundColor: '#DCF8C6',
    alignSelf: 'flex-end',
  },
  adminBubble: {
    backgroundColor: '#EAEAEA',
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 14,
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    backgroundColor: '#FFF',
    position: 'absolute',
    bottom: 0,
    width: '100%',
  },
  input: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    borderRadius: 20,
    paddingHorizontal: 15,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: '#FF0000',
    marginLeft: 10,
    borderRadius: 20,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  sendText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});
