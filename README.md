<p align="center">
  <img src="https://raw.githubusercontent.com/Thavaneshwaran/RAGCore/main/banner.png" width="90%" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript" />
  <img src="https://img.shields.io/badge/Vite-Build-purple?style=for-the-badge&logo=vite" />
  <img src="https://img.shields.io/badge/Supabase-Vector_DB-3ECF8E?style=for-the-badge&logo=supabase" />
  <img src="https://img.shields.io/badge/Status-Active-success?style=for-the-badge" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
</p>


📘 RAGCore — Retrieval-Augmented AI Chat System

RAGCore is a modular, high-performance Retrieval-Augmented Generation (RAG) chat system built with React, TypeScript, Vite, and Supabase.
It supports multiple LLM providers, flexible RAG modes, embeddings, document ingestion, and learning tools—all wrapped in a clean, modern UI.

This repository contains a fully cleaned version of the source code with no secrets, no node_modules, and no builder metadata.

🚀 Features
🔍 RAG Engine

PDF + text ingestion

Smart chunking

Vector storage in Supabase

Similarity search + contextual answer generation

Switch between multiple RAG modes in UI

🤖 LLM Provider Integration

Local Ollama

Cloud providers (OpenAI, Gemini, Groq, etc.)

Provider selection UI

Each mode configurable by the user

🗣️ Voice + Media Tools

Microphone input

Text-to-speech

OCR via Supabase Edge Functions

📚 Learning Tools

Flashcard generator

Learning mode

Notes summarization

🧩 Clean Architecture

Provider abstraction layer

Embeddings pipeline

Modular React components

Supabase Functions for compute-heavy tasks

📂 Project Structure
RAGCore/
│
├── src/
│   ├── components/         # UI components (chat, settings, panels)
│   ├── lib/                # RAG logic, providers, embeddings, vector ops
│   ├── hooks/              # Shared custom hooks
│   ├── pages/              # Page-level components
│   └── types/              # Shared TS types
│
├── supabase/
│   └── functions/          # OCR, embeddings, TTS, voice-to-text
│
├── public/                 # Static assets
├── .env.example            # Template for environment variables
├── .gitignore              # Prevents secrets & build artifacts from being committed
├── package.json
├── vite.config.ts
└── README.md

🔧 Setup Instructions
1️⃣ Install dependencies
npm install

2️⃣ Create your environment file
cp .env.example .env


Fill in your Supabase + provider API keys:

VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=

# Optional
# VITE_OPENAI_API_KEY=
# VITE_OLLAMA_URL=
# VITE_OLLAMA_API_KEY=


✔ .env is private and ignored by Git—safe to use locally.

▶️ Development Server
npm run dev


App runs at:

http://localhost:5173

📦 Build for Production
npm run build

🔐 Security Guide

Your client-side environment variables beginning with VITE_ are public.
Do NOT put:

Supabase service_role

Secret provider API keys

Admin tokens

Rotate any compromised keys immediately.

🧪 Running Supabase Functions (optional)
supabase start
supabase functions serve --env-file .env

🛠️ Customizing RAG Behavior

Core logic lives in:

src/lib/rag/


Key components:

ragService.ts → RAG pipeline

remoteProvider.ts → LLM provider switch

vectorStore.ts → embedding/indexing

chunker.ts → chunking strategies

Settings UI:

src/components/settings/

🗺️ Roadmap

 Support multi-document indexing

 Add chunk-size tuning

 WebGPU-based local embedding

 Local model download manager

 Chat analytics + session playback

🤝 Contributing

Pull requests are welcome.
Open an issue for feature requests or improvements.

📄 License

MIT License.
