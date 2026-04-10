# Centaurion Framework

> **Fitness = Predictive Order / Thermodynamic Cost**

Human-AI augmentation framework grounded in Karl Friston's Free Energy Principle and Active Inference.

## Architecture

```
Centaurion Framework
├── Neurowellness Stack (AOB)     — Sensing layer: wearables + on-device Gemma 4
├── Cognitive Component           — Prediction layer: 5-level human modeling
└── Symbiotic Engine              — Binding layer: cryptographic co-evolution
```

## Three Laws

1. **Hierarchy** — Nested layers of prediction, from cellular to cognitive to social
2. **Routing** — Information flows to the agent best positioned to reduce uncertainty
3. **Coupling** — Human and AI share a generative model; both evolve through mutual prediction

## Components

### Neurowellness Stack (for Alchemy of Breath)
- 20 biomarkers across 4 tiers: Respiratory, ANS, Cognitive/Mind State, Metabolic
- On-device breath analysis via Gemma 4 E2B/E4B
- Unified wearable ingestion via Terra API (Whoop, Oura, Apple Health)
- AI coaching via Claude API
- Facilitator dashboard + group coherence analytics

### Cognitive Component
- L1: Physiological Prediction (body state forecasting)
- L2: Behavioral Prediction (action pattern modeling)
- L3: Cognitive Prediction (decision-making patterns)
- L4: Intentional Prediction (goal inference)
- L5: Metacognitive Mirror (reflects patterns back to human)

### Symbiotic Engine
- **Outer Shield:** Ed25519 key pair, ZK proofs, temporal attestation chain
- **Inner Channel:** Shared Generative Model, mutual prediction error exchange, Coupling Strength Index, consent-gated model evolution

## Development Methodology

Autoresearch loop adapted from [karpathy/autoresearch](https://github.com/karpathy/autoresearch):

```
Hypothesis → Experiment → Measure → Keep or Discard → Repeat
```

**Composite Score** = 0.40 x Prediction Accuracy + 0.30 x User Satisfaction + 0.30 x System Efficiency

See [program.md](program.md) for full methodology.

## Milestones

| Milestone | Target | Focus |
|-----------|--------|-------|
| M0: Foundation | Apr 20, 2026 | Supabase schema, Terra sandbox, static dashboard |
| M1: Prototype | May 9, 2026 | Real wearable data flowing, basic coaching |
| M2: Intelligence | Jun 13, 2026 | Cognitive Component L1-L2, baseline model |
| M3: Bond | Jul 18, 2026 | Symbiotic Engine Ed25519 + SGM |
| M4: AOB Integration | Aug 22, 2026 | Facilitator dashboard, student journey |
| M5: Autoresearch | Sep 2026+ | Self-improving methodology loop |

## Tech Stack

- **Data:** Supabase (PostgreSQL + RLS + Edge Functions + Vault)
- **On-device AI:** Gemma 4 E2B/E4B via Google AI Edge SDK
- **Cloud reasoning:** Claude API
- **Wearables:** Terra API (unified: Whoop, Oura, Apple Health, Garmin)
- **Crypto:** Ed25519 (Web Crypto API), zk-SNARKs (snarkjs), Merkle trees
- **Frontend:** React
- **Infrastructure:** Hostinger VPS, GitHub Actions

---

Built by [Malik Palamar](https://centaurion.me) · Fractional CEO · BuilderBee x AOB x Centaurion
