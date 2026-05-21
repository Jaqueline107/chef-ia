import React, { useEffect, useState } from 'react';
import axios from 'axios';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';

import {
  View,
  Text,
  TextInput,
  Image,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Keyboard,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';

const GROQ_APIKEY = process.env.EXPO_PUBLIC_GROQ_APIKEY;

export default function App() {
  const [ingredientes, setIngredientes] = useState('');
  const [receita, setReceita] = useState('');
  const [loading, setLoading] = useState(false);
  const [appReady, setAppReady] = useState(false);

  // 🍳 MODO COZINHA PRO
  const [modoCozinha, setModoCozinha] = useState(false);
  const [passos, setPassos] = useState<string[]>([]);
  const [passoAtual, setPassoAtual] = useState(0);
  const [vozAtiva, setVozAtiva] = useState(false);

  const autoPlay = true; // 🔥 automático ON
  const tempoPasso = 6; // segundos por passo

  const api = axios.create({
    baseURL: "https://api.groq.com/openai/v1/chat/completions",
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_APIKEY}`
    }
  });

  useEffect(() => {
    const prepareApp = async () => {
      await new Promise(r => setTimeout(r, 1500));
      setAppReady(true);
    };
    prepareApp();
  }, []);

  function extrairPassos(texto: string) {
    const regex = /\d+\.\s(.+)/g;
    const encontrados = [...texto.matchAll(regex)];
    return encontrados.map(i => i[1]);
  }

  function falar(texto: string) {
    Speech.stop();
    Speech.speak(texto, {
      language: 'pt-BR',
      rate: 2,
      pitch: 1,
    });
  }

  async function gerarReceita() {
    try {
      setLoading(true);

      const resposta = await api.post('', {
        model: "llama-3.1-8b-instant",
        max_tokens: 1024,
        temperature: 1,
        messages: [
          {
            role: "system",
            content: `Você é um chef. Sempre use passos numerados no preparo.`
          },
          {
            role: "user",
            content: `Ingredientes: ${ingredientes}`
          }
        ],
      });

      let texto = resposta.data.choices[0].message.content;
      texto = texto.replace(/\*\*/g, '');

      setReceita(texto);

      let buffer = '';
      for (let i = 0; i < texto.length; i++) {
        buffer += texto[i];
        setReceita(buffer);
        await new Promise(r => setTimeout(r, 8));
      }

      const passosExtraidos = extrairPassos(texto);
      setPassos(passosExtraidos);
      setPassoAtual(0);

    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  }

  // 🔊 VOZ
  useEffect(() => {
    if (modoCozinha && vozAtiva && passos[passoAtual]) {
      Speech.stop();
      setTimeout(() => {
        falar(passos[passoAtual]);
      }, 200);
    }
  }, [passoAtual, modoCozinha, vozAtiva]);

  // ⚡ AUTO NEXT + VIBRAÇÃO
  useEffect(() => {
    if (!modoCozinha || !passos.length) return;

    const timer = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      setPassoAtual(prev => {
        if (prev < passos.length - 1) {
          return prev + 1;
        } else {
          setModoCozinha(false);
          return prev;
        }
      });
    }, tempoPasso * 1000);

    return () => clearTimeout(timer);
  }, [passoAtual, modoCozinha]);

  if (!appReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0b0f1a' }}>
        <Image
          source={require('./assets/chef-splash.png')}
          style={{ width: '100%', height: '100%', position: 'absolute' }}
        />
      </View>
    );
  }

  // 🍳 MODO COZINHA
  if (modoCozinha) {
    const passo = passos[passoAtual] || '';

    return (
      <View style={styles.cozinhaContainer}>

        <Text style={styles.cozinhaTitulo}>
          🍳 {passoAtual + 1} / {passos.length}
        </Text>

        {/* PROGRESSO */}
        <View style={styles.progressBar}>
          <View
            style={{
              width: `${((passoAtual + 1) / passos.length) * 100}%`,
              height: 6,
              backgroundColor: '#48C748',
              borderRadius: 10,
            }}
          />
        </View>

        <Text style={styles.cozinhaPasso}>
          {passo}
        </Text>

        <TouchableOpacity onPress={() => setVozAtiva(!vozAtiva)}>
          <Text style={{ color: '#48C748', marginBottom: 20 }}>
            {vozAtiva ? "🔊 Voz ON" : "🔇 Voz OFF"}
          </Text>
        </TouchableOpacity>

        <View style={styles.cozinhaBotoes}>

          <TouchableOpacity
            disabled={passoAtual === 0}
            onPress={() => setPassoAtual(passoAtual - 1)}
          >
            <Text style={styles.navBtn}>⬅️</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              if (passoAtual < passos.length - 1) {
                setPassoAtual(passoAtual + 1);
              } else {
                setModoCozinha(false);
              }
            }}
          >
            <Text style={styles.navBtn}>
              {passoAtual === passos.length - 1 ? "🏁" : "➡️"}
            </Text>
          </TouchableOpacity>

        </View>

      </View>
    );
  }

  // 🌙 HOME
  return (
    <LinearGradient colors={['#0b0f1a', '#070d2a', '#0d092e']} style={{ flex: 1 }}>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>

          <View style={styles.container}>

            <StatusBar barStyle="light-content" />

            <Text style={styles.title}>👩‍🍳 Chef IA</Text>

            <TextInput
              style={styles.input}
              placeholder="ingredientes..."
              placeholderTextColor="#888"
              value={ingredientes}
              onChangeText={setIngredientes}
              multiline
            />

            <TouchableOpacity style={styles.button} onPress={gerarReceita}>
              <Text style={styles.buttonText}>
                {loading ? "Gerando..." : "Gerar Receita"}
              </Text>
            </TouchableOpacity>

            {receita ? (
              <>
                <ScrollView style={styles.receitaContainer}>
                  <Text style={styles.receita}>{receita}</Text>
                </ScrollView>

                <TouchableOpacity
                  style={styles.modoButton}
                  onPress={() => {
                    setModoCozinha(true);
                    setPassoAtual(0);
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                    🍳 Modo Cozinha PRO
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={{ color: '#aaa', textAlign: 'center', marginTop: 50 }}>
                Nenhuma receita ainda
              </Text>
            )}

          </View>

        </ScrollView>

      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({

  container: { flex: 1, padding: 20, paddingTop: 60 },

  title: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 20 },

  input: {
    backgroundColor: '#2d2d44',
    color: '#fff',
    padding: 15,
    borderRadius: 10,
    minHeight: 100,
    marginBottom: 20,
  },

  button: {
    backgroundColor: '#48C748',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },

  buttonText: { color: '#fff', fontWeight: 'bold' },

  receitaContainer: {
    marginTop: 20,
    backgroundColor: '#2d2d44',
    padding: 15,
    borderRadius: 10,
    maxHeight: 250,
  },

  receita: { color: '#fff' },

  modoButton: {
    marginTop: 10,
    backgroundColor: '#ff7b00',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },

  cozinhaContainer: {
    flex: 1,
    backgroundColor: '#0b0f1a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  cozinhaTitulo: {
    color: '#aaa',
    fontSize: 18,
    marginBottom: 10,
  },

  cozinhaPasso: {
    color: '#fff',
    fontSize: 30,
    textAlign: 'center',
    marginVertical: 30,
  },

  cozinhaBotoes: {
    flexDirection: 'row',
    gap: 40,
  },

  navBtn: {
    color: '#48C748',
    fontSize: 32,
    marginHorizontal: 20,
  },

  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#222',
    borderRadius: 10,
    marginBottom: 20,
    overflow: 'hidden',
  }

});