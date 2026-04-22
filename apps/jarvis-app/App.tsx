import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useChat } from './src/hooks/useChat';
import type { ChatMessage } from './src/types';

type ExtraConfig = {
  orchestratorUrl?: string;
  orchestratorToken?: string;
  agentId?: string;
};

function resolveConfig(): ExtraConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;
  return {
    orchestratorUrl:
      process.env.EXPO_PUBLIC_ORCHESTRATOR_URL ??
      extra.orchestratorUrl ??
      'http://localhost:8000',
    orchestratorToken:
      process.env.EXPO_PUBLIC_ORCHESTRATOR_TOKEN ??
      extra.orchestratorToken ??
      '',
    agentId:
      process.env.EXPO_PUBLIC_AGENT_ID ?? extra.agentId ?? 'claudinho',
  };
}

export default function App() {
  const resolved = useMemo(resolveConfig, []);
  const config = useMemo(
    () => ({
      baseUrl: resolved.orchestratorUrl!,
      token: resolved.orchestratorToken!,
      agentId: resolved.agentId,
    }),
    [resolved],
  );

  const { messages, sending, error, send, reset } = useChat({ config });
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const missingConfig = !config.baseUrl || !config.token;

  const handleSend = () => {
    const query = input.trim();
    if (!query) return;
    setInput('');
    send(query);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.brand}>Jarvis</Text>
        <Text style={styles.subtitle}>
          {config.agentId} · {resolved.orchestratorUrl?.replace(/^https?:\/\//, '')}
        </Text>
        {messages.length > 0 && (
          <Pressable onPress={reset} hitSlop={12}>
            <Text style={styles.resetText}>limpar</Text>
          </Pressable>
        )}
      </View>

      {missingConfig ? (
        <View style={styles.configWarning}>
          <Text style={styles.configWarningTitle}>Configuração incompleta</Text>
          <Text style={styles.configWarningBody}>
            Defina{' '}
            <Text style={styles.code}>EXPO_PUBLIC_ORCHESTRATOR_URL</Text> e{' '}
            <Text style={styles.code}>EXPO_PUBLIC_ORCHESTRATOR_TOKEN</Text> no{' '}
            <Text style={styles.code}>.env</Text> ou em{' '}
            <Text style={styles.code}>app.json → extra</Text> antes de conversar.
          </Text>
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyHint}>
            Mande a primeira mensagem pro Claudinho.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messagesContent}
          renderItem={({ item }) => <MessageBubble message={item} />}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
        />
      )}

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠ {error}</Text>
        </View>
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={sending ? 'aguarde resposta...' : 'fala com o Claudinho'}
          placeholderTextColor="#5F7A99"
          editable={!sending && !missingConfig}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          multiline
        />
        <Pressable
          style={({ pressed }) => [
            styles.sendButton,
            (sending || !input.trim() || missingConfig) && styles.sendDisabled,
            pressed && styles.sendPressed,
          ]}
          onPress={handleSend}
          disabled={sending || !input.trim() || missingConfig}
        >
          {sending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.sendText}>↑</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <View
      style={[
        styles.bubble,
        isUser ? styles.bubbleUser : styles.bubbleAssistant,
      ]}
    >
      <Text style={styles.bubbleText}>
        {message.content}
        {message.streaming && <Text style={styles.cursor}>▍</Text>}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F14',
  },
  header: {
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1B2530',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  brand: {
    color: '#E6F1FF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#64FFDA',
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    flex: 1,
  },
  resetText: {
    color: '#5F7A99',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyHint: {
    color: '#5F7A99',
    fontSize: 14,
    textAlign: 'center',
  },
  configWarning: {
    margin: 20,
    padding: 16,
    backgroundColor: '#2A1F14',
    borderLeftWidth: 3,
    borderLeftColor: '#FFB86B',
    borderRadius: 6,
  },
  configWarningTitle: {
    color: '#FFB86B',
    fontWeight: '700',
    marginBottom: 6,
    fontSize: 13,
  },
  configWarningBody: {
    color: '#E6F1FF',
    fontSize: 13,
    lineHeight: 18,
  },
  code: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    backgroundColor: '#0B0F14',
    color: '#64FFDA',
  },
  messagesContent: {
    padding: 16,
    gap: 10,
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#1E88E5',
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: '#1B2530',
  },
  bubbleText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 21,
  },
  cursor: {
    color: '#64FFDA',
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: '#3A1414',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#B00020',
  },
  errorText: {
    color: '#FF8A8A',
    fontSize: 13,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#0B0F14',
    borderTopWidth: 1,
    borderTopColor: '#1B2530',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#1B2530',
    color: '#E6F1FF',
    borderRadius: 20,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E88E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    opacity: 0.4,
  },
  sendPressed: {
    backgroundColor: '#1565C0',
    transform: [{ scale: 0.96 }],
  },
  sendText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
});
