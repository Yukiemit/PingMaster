import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import { Footer } from '../components/Layout.jsx';
import { Bolt, CalendarCheck, Chevron, Heart, Users, Utensils } from '../components/Icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import spread from '../assets/spread.jpg';
import friends from '../assets/friends.jpg';
import payment from '../assets/payment.jpg';
import ramen from '../assets/ramen.jpg';
import boodle from '../assets/boodle.jpg';
import './landing.css';

const DEMO = [
  { name: 'Ramen Night', meta: 'Japanese Food • 300–500 budget • 500 m away', img: ramen },
  { name: 'Boodle Fight Feast', meta: 'Filipino Food • 250–450 budget • 800 m away', img: boodle },
  { name: 'Curry House Crawl', meta: 'Indian Food • 350–600 budget • 1.2 km away', img: spread },
];

export default function Landing() {
  const { user, guest } = useAuth();
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const [votes, setVotes] = useState([]);

  const start = () => navigate(user ? '/home' : '/signup');
  const asGuest = async () => { if (!user) await guest(); navigate('/home'); };
  const vote = (v) => { setVotes((vs) => [...vs, { ...DEMO[i], v }]); setI((n) => n + 1); };
  const done = i >= DEMO.length;
  const liked = votes.filter((v) => v.v === 'like');

  return (
    <div className="landing">
      <header className="pnav">
        <Link to="/" aria-label="Saan Tayo? home"><Logo size={52} /></Link>
        <nav className="pnav__links" aria-label="Main">
          <a className="pnav__pill pnav__pill--green" href="#top">Home</a>
          <a className="pnav__pill pnav__pill--red" href="#features">Features</a>
          <a className="pnav__pill pnav__pill--red" href="#how">How It Works</a>
          {user
            ? <Link className="pnav__pill pnav__pill--yellow" to="/home">Open App</Link>
            : <Link className="pnav__pill pnav__pill--yellow" to="/login">Sign In</Link>}
          <button className="pnav__pill pnav__pill--fill" onClick={start}>Tara, Kain! <Chevron size={16} /></button>
        </nav>
      </header>

      <section id="top" className="lhero" style={{ '--bg': `url(${spread})` }}>
        <div className="lhero__inner">
          <h1>Saan tayo<br />kakain?</h1>
          <p className="lhero__tag">Less arguing, more eating.</p>
          <div className="lhero__row">
            <p>Tired of the endless “Kahit saan” conversation? Find restaurants that match your barkada’s cravings, budget, and location—all in one place.</p>
            <button className="btn btn--cream" onClick={start}>Start Now <Chevron size={20} /></button>
          </div>
        </div>
      </section>

      <section id="how" className="lsteps container">
        <article className="lstep lstep--green">
          <h3>01. Gather the Barkada</h3>
          <Users width={64} height={64} />
          <p>Create a group, share the link, and enter everyone’s food preferences.</p>
        </article>
        <article className="lstep lstep--yellow">
          <h3>02. Swipe &amp; Decide</h3>
          <Heart width={64} height={64} />
          <p>Discover matching restaurants and vote Like, Dislike, or Skip.</p>
        </article>
        <article className="lstep lstep--red">
          <h3>03. Eat &amp; Split</h3>
          <Utensils width={64} height={64} />
          <p>Get your winning restaurant, schedule the meetup, and split expenses.</p>
        </article>
      </section>

      <section id="features" className="lfeat container">
        <img className="lfeat__wide" src={spread} alt="A table of curries, rice and flatbreads" />
        <h2>Restaurants that fit everyone’s cravings.</h2>
        <p>No more guessing. Discover dining spots based on your group’s budget, preferred cuisine, and location.</p>

        <div className="lfeat__pair">
          <div>
            <img src={friends} alt="Three friends looking at a phone together" />
            <h2>Vote, don’t argue.</h2>
            <p>Like, Dislike, or Skip. The system automatically determines the winning restaurant.</p>
          </div>
          <div>
            <img src={payment} alt="Friends paying with cards at a terminal" />
            <h2>Ambagan made easy.</h2>
            <p>Split individual orders and shared expenses. Track who has already paid.</p>
          </div>
        </div>

        <div className="lfeat__plan">
          <CalendarCheck width={84} height={84} />
          <div>
            <h2>Plan it. Save it. Show up.</h2>
            <p>Keep your dining schedule organized and optionally add it to your Google Calendar.</p>
          </div>
        </div>
      </section>

      <section className="ltry">
        <p className="ltry__kicker">TRY IT YOURSELF</p>
        <h2>What’s your food mood today?</h2>
        <p className="ltry__sub">Try the voting experience!</p>
        {!done ? (
          <div className="ltry__card" key={i}>
            <img src={DEMO[i].img} alt="" />
            <h3>{DEMO[i].name}</h3>
            <p>{DEMO[i].meta}</p>
            <div className="ltry__btns">
              <button className="vbtn vbtn--no" onClick={() => vote('dislike')}>Dislike</button>
              <button className="vbtn vbtn--skip" onClick={() => vote('skip')}>Skip</button>
              <button className="vbtn vbtn--yes" onClick={() => vote('like')}>Like</button>
            </div>
            <p className="ltry__count">{i + 1} of {DEMO.length}</p>
          </div>
        ) : (
          <div className="ltry__card ltry__done">
            <h3>{liked.length ? `Panalo: ${liked[0].name}!` : 'Walang nanalo… kahit saan na lang?'}</h3>
            <p>{liked.length ? 'In a real session, everyone’s votes decide the winner.' : 'In a real session, the best match wins when nobody agrees.'}</p>
            <button className="btn btn--red" onClick={() => { setI(0); setVotes([]); }}>Try again</button>
          </div>
        )}
      </section>

      <section className="lguest">
        <Bolt width={34} height={34} />
        <h2>No Account? No Problem!</h2>
        <p>You don’t need to sign up to settle the food debate. Create a group, invite your friends, and start deciding right away.</p>
        <button className="btn btn--outline-red lguest__btn" onClick={asGuest}>Continue As Guest</button>
        <small>Sign up anytime to keep your dining history in one place.</small>
      </section>

      <section className="lend">
        <h2><span className="g">Less “Saan tayo?”</span><span className="b">More “Tara na!”</span></h2>
        <p>Your next food trip is just a few clicks away.</p>
        <button className="btn btn--outline-red lguest__btn" onClick={start}>Start Your Food Trip</button>
      </section>
      <Footer />
    </div>
  );
}
