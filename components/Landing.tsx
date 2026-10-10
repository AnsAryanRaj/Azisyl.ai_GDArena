"use client";
import { MODERATOR, PANEL } from "@/lib/personas";
import Avatar from "./Avatar";
import { LogoMark, MicIcon, SparkIcon } from "./Icons";

interface Props {
  onLogIn: () => void;
  onSignUp: () => void;
  onGuest: () => void;
}

/** Public landing page: what GD Arena is, and the way in. */
export default function Landing({ onLogIn, onSignUp, onGuest }: Props) {
  return (
    <>
      <section className="hero">
        <div className="sky" aria-hidden="true">
          <img src="/sky.svg" alt="" />
        </div>

        <nav className="nav" aria-label="Main">
          <a className="logo" href="#top" aria-label="GD Arena home">
            <LogoMark />
            GD Arena
          </a>
          <div className="navlinks">
            <a href="#how">How it works</a>
            <a href="#panel">The panel</a>
            <a href="#feedback">Sample report</a>
          </div>
          <div className="nav-right">
            <button className="pill ghost" type="button" onClick={onLogIn}>
              Log in
            </button>
            <button className="pill dark" type="button" onClick={onSignUp}>
              Sign up
            </button>
          </div>
        </nav>

        <div className="hero-body landing-body" id="top">
          <span className="ai-chip">
            <i aria-hidden="true" /> Everyone else at the table is AI
          </span>
          <h1>
            Your first GD should <em>not</em> be the real one.
          </h1>
          <p className="sub">
            Sit with an AI panel that argues, interrupts and drifts off topic, like a real placement group discussion.
            Then get feedback that quotes exactly what you said.
          </p>
          <div className="cta-row">
            <button className="pill sun" type="button" onClick={onSignUp}>
              Start practising free
              <span className="icon-disc">
                <MicIcon />
              </span>
            </button>
            <button className="pill ghost" type="button" onClick={onGuest}>
              Try it as a guest
            </button>
          </div>
          <p className="have-account">
            Already have an account?{" "}
            <button type="button" className="linkish" onClick={onLogIn} style={{ color: "#fff" }}>
              Log in
            </button>
          </p>
          <ul className="proof" aria-label="What you get">
            <li className="glass">5 AI personalities with their own voices</li>
            <li className="glass">Choose your side: for or against</li>
            <li className="glass">Report with quoted moments</li>
          </ul>
        </div>
        <div className="ground" aria-hidden="true">
          <img src="/ground.svg" alt="" />
        </div>
      </section>

      <section className="section" id="how">
        <h2>A real GD room, any time you want one.</h2>
        <p className="lead">
          Most students walk into their first group discussion without ever sitting in one. GD Arena gives you the room,
          the people and an honest assessor.
        </p>
        <ol className="steps">
          <li>
            <h3>Pick a topic and your panel</h3>
            <p>Choose from current affairs, business, tech or abstract topics, or type your own. Pick 3 to 5 AI participants.</p>
          </li>
          <li>
            <h3>Speak like you would in the room</h3>
            <p>Ms. Rao opens, the timer runs, and the panel debates out loud. Tap Speak to jump in. They stop when you cut in.</p>
          </li>
          <li>
            <h3>Read your report</h3>
            <p>See who spoke how much, and get scores on six GD skills. Every point links to the exact moment in the transcript.</p>
          </li>
        </ol>
      </section>

      <section className="section" id="panel">
        <h2>Meet the people at your table.</h2>
        <p className="lead">Each one has a different personality and voice, so you practise handling the people you will actually meet.</p>
        <div className="cast">
          {[MODERATOR, ...PANEL].map((p) => (
            <div className="cast-card" key={p.id}>
              <Avatar look={p.look} shirt={p.color} size={72} />
              <b>{p.name}</b>
              <span>{p.role}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="feedback">
        <div className="sample">
          <div className="scene" aria-hidden="true">
            <img src="/scene.svg" alt="" />
          </div>
          <div>
            <h2>Feedback that points to what you said.</h2>
            <p className="lead">
              No vague &quot;be more confident&quot;. Each score comes with a quote from your discussion and one thing to try next
              time.
            </p>
            <button className="pill sun" type="button" onClick={onSignUp}>
              Start practising free
              <span className="icon-disc">
                <SparkIcon />
              </span>
            </button>
          </div>
          <div className="sample-card glass">
            <div className="point-head">
              <h3 style={{ margin: 0 }}>Handling interruptions</h3>
              <span className="pips" aria-label="2 out of 5">
                <i className="on" />
                <i className="on" />
                <i />
                <i />
                <i />
              </span>
            </div>
            <p style={{ margin: "8px 0 0" }}>When Arjun cut in, you stopped and did not return to your point.</p>
            <p style={{ margin: "6px 0 0", color: "var(--glass-muted)" }}>
              Next time: say &quot;Let me finish this one point&quot; calmly, then complete it in one sentence.
            </p>
            <div className="quote" style={{ cursor: "default" }}>
              <small>Arjun, 2:14</small>
              &quot;Let me stop you there. Theory sounds nice, but companies care about results.&quot;
            </div>
          </div>
        </div>
      </section>


      <section className="section final-cta">
        <h2>Ready for your first practice GD?</h2>
        <p className="lead">It takes five minutes. No setup, no group to organise.</p>
        <div className="cta-row" style={{ justifyContent: "flex-start" }}>
          <button className="pill dark" type="button" onClick={onSignUp}>
            Create a free account
          </button>
          <button className="pill plain" type="button" onClick={onLogIn}>
            I already have an account
          </button>
        </div>
      </section>

      <footer className="footer">
        GD Arena is a practice tool. The other participants and the assessor are AI, and their views are generated.
      </footer>
    </>
  );
}
