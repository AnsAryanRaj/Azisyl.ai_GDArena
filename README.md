# GD Arena

**Problem statement 2: GD Arena**

## What it does

GD Arena is a voice-first room where a student practises a campus group discussion (GD) with AI participants. A moderator opens the discussion, 3 to 5 AI participants with different personalities and voices argue with each other and with the student, and a timer and closing round keep it structured like a real GD. At the end, the student gets a report on six GD skills, where every feedback point links to a quoted moment in the transcript.

## Done / Left / Plan

**Done**

- Setup: topic list by category (current affairs, business, tech, social, regional, abstract, controversial, case), custom topic, panel size 3 to 5, duration, English or Hinglish, student name
- Choose your side: argue in favour, against, or decide as you go. When you pick a side, the panel is set up so at least two AI participants take the opposite side and challenge you, and the report checks whether you held your side
- Live transcription: while you speak, your words appear live in the caption box and as a "speaking now" line in the transcript
- Custom topic: type any topic, or use the Custom tab
- Silent nudges (visual only, never spoken): after 1, 2 or 3 minutes of silence (you choose, or turn them off), when Arjun is holding the floor, when you are talking too much, and when a turn runs too long
- "What you could have said" replay: up to three missed openings, each with why it was an opening and a sample line. Play the moment to hear the line and then the suggested answer, and see it highlighted in the transcript
- Four GD formats: standard, case-based (the moderator reads out a business case), controversial (sharper disagreement, moderator keeps it respectful) and fishbowl (the student watches the AI panel first, then the moderator brings them in)
- Live spoken discussion: push-to-talk speech recognition with live captions, AI participants speak out loud with different voices, pitch and speed. Voices match each participant's gender (female voices for Ms. Rao, Priya and Meera, male voices for Arjun, Kabir and Rohan), with a pitch fallback on devices that only have one kind of voice
- Five personalities plus a moderator: the dominator, the data-driven one, the quiet one, the one who drifts, the consensus builder
- Real back-and-forth: at the start, each AI participant is given its own position on the topic (for, against or middle) and a few arguments. They defend that position all through, counter each other by name, and must answer the student's exact point when the student speaks. Points already made are not repeated
- The student gets the floor: after two AI lines in a row, the next speaker asks the student a direct question and the room waits. If the student lets it pass, Ms. Rao points out that silence costs marks and asks again. A silent nudge appears after every minute of silence
- Natural turn-taking: AI waits for a pause (adjustable), never talks over another AI, and stops the moment the student starts speaking (barge-in). AI participants reply to each other by name
- Structure: moderator intro, timer, "End discussion", closing round where every AI concludes, then the student gives the last word
- Report: speaking share per person, six scored skills (starting, ideas, building on others, listening, handling interruptions, ending), each with a verdict, a tip and a clickable transcript quote. "What you could have said" shows one missed opening
- Silent nudge if the student has not spoken for 2 minutes. The moderator invites the student by name after 90 seconds of silence
- Error handling: mic denied or missing, browsers without speech support, offline, failed or slow AI calls (falls back to scripted lines so the room never freezes), bad input to the API
- Progress over time: average score per skill across sessions, strongest skill, skill to work on next, speaking-share habit, how often the student opened the discussion, and "up or down from last time" on each report. Stored only on the device
- Feedback: students rate each session (1 to 5 stars plus a comment) on the report, or any time from "Give feedback" in the menu. Sent to `/api/feedback` and shown in the server logs
- Demo mode: runs without any API key using scripted replies

**Left**

- Deploy to Vercel and add the live URL here
- Test with a real API key on venue Wi-Fi and tune the AI wait time
- Optional: premium voices (ElevenLabs or OpenAI TTS) for more realistic speech
- Friends joining the same room with AI filling empty seats needs a real-time server (WebSockets), planned after the hackathon

**Plan**

Deploy first, then do two full practice runs on a phone and a laptop, then polish copy and the demo script.

## Architecture and why

```
Browser (Next.js, React)
 ├─ Web Speech API  → student speech to text (push-to-talk, live captions)
 ├─ speechSynthesis → a different voice for each AI participant
 └─ Room engine     → phases, timer, barge-in, prefetching the next turn
        │  POST /api/turn     (who speaks next + what they say)
        │  POST /api/report   (assessment with quote ids)
        │  POST /api/plan     (each AI's position, once per room)
        │  POST /api/feedback (rating and comment)
        ▼
Next.js API routes (server)
 ├─ input validation and length limits
 ├─ one "director" prompt picks the next speaker and writes their line
 └─ any OpenAI-compatible LLM: Gemini, Groq or OpenAI (key stays on the server)
```

Key choices:

- **One director instead of independent agents.** A single LLM call looks at the transcript and decides who speaks next. That is what stops AI participants from talking over each other, and it lets them respond to each other naturally.
- **Push-to-talk instead of always-on listening.** Hackathon halls and hostels are noisy. Push-to-talk makes speech recognition reliable and makes barge-in instant: pressing Speak cancels the current AI voice.
- **Browser speech APIs.** Free, no keys, very low delay, and they work in Chrome and Edge on laptop and Android.
- **Prefetching.** While one AI participant is speaking, the next turn is already being generated, so there is almost no dead air.
- **Quotes are verified on the server.** The report model must cite transcript line ids. The server drops any id that does not exist, so every feedback point links to something the student really heard or said.
- **Fast, cheap model.** By default the app asks the Gemini API which Flash models the key can use and picks the newest, with thinking kept low. Short turns (under 45 words) keep the reply time low.
- **No database.** Sessions are short and personal. History is stored only in the student's own browser.

## What we added

- **Hinglish room:** AI participants speak a natural Hindi-English mix, the way students actually talk.
- **GD formats:** case-based, controversial and fishbowl rooms, plus regional topics.
- **Progress over time:** skill averages and habits across sessions.
- **Feedback button:** students can rate a session and tell us what to improve.
- **"What you could have said":** one missed moment from the discussion with a sample line.
- **Adjustable patience:** the student chooses how long the AI waits before speaking (also an accessibility feature).
- **Captions-only mode:** turn AI voices off and follow the live captions.
- **Demo mode:** the app works end to end without an API key, which keeps the demo safe if the network fails.

## Checking the AI connection

Open `/api/status?check=1` (for example http://localhost:3000/api/status?check=1). It makes one tiny AI call and shows `"ok": true`, or the exact error, such as a wrong key or a rate limit. The home screen shows the same warning. With a free Gemini key the app automatically moves to the next Gemini model if one is rate-limited or retired.

## How to run it

Requirements: Node.js 20 or newer. Use Chrome or Edge for voice input.

```bash
npm install
cp .env.example .env.local   # then add your key, or leave it empty for demo mode
npm run dev
```

Open http://localhost:3000 and allow the microphone.

Environment variables (see `.env.example`):

| Variable | Meaning |
|---|---|
| `LLM_PROVIDER` | `gemini`, `groq` or `openai` |
| `LLM_API_KEY` | API key for that provider. Empty means demo mode |
| `LLM_MODEL` | Optional model override |
| `LLM_BASE_URL` | Optional, any other OpenAI-compatible endpoint |

Deploy: import the repo on Vercel, add the same environment variables, deploy. No test login is needed.

Live URL: _add after deployment_

## Tools and AI used

- Next.js 16, React 19, TypeScript
- Web Speech API (speech recognition) and speechSynthesis (AI voices), built into the browser
- LLM through an OpenAI-compatible API: the newest Gemini Flash model by default (found automatically), Groq Llama 3.3 70B or GPT-4o mini as options
- Fonts: Instrument Serif and Plus Jakarta Sans (bundled with Fontsource)
- The campus illustration is generated by `scripts/make_scene.py` as plain SVG
- AI coding assistants were used while building

How users are told they are talking to AI: the home screen says "Everyone else at the table is AI", the room shows "All other participants are AI" at all times, and the footer explains that the participants and assessor are AI and their views are generated.

## Who it is for

College students preparing for campus placements, especially those who have never sat in a real GD. They come back because each session takes 5 minutes, every topic plays out differently, the report shows exactly what to fix, and their past scores show whether they are improving.
