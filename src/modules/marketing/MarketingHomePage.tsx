import { useState, useEffect, useRef } from "react"
import "./marketing-home.css"

// ─── Data ───────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
        <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    title: "Pointage des enseignants",
    text: "Chaque présence est enregistrée, horodatée et associée à un cours planifié. Le calcul des heures est automatique et incontestable.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    title: "Suivi des élèves",
    text: "Appel par classe, historique complet des présences et statistiques de fréquentation accessibles en un clic.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: "Espace parents",
    text: "Les parents consultent les présences en temps réel, l'emploi du temps et reçoivent des notifications SMS ou e-mail à chaque absence.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
        <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
        <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
        <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
      </svg>
    ),
    title: "Tableau de bord directeur",
    text: "Vue d'ensemble de l'établissement : taux de présence, heures effectuées, alertes, salaires, emplois du temps - tout centralisé.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    title: "Calcul automatique des salaires",
    text: "Les heures réellement effectuées alimentent directement la paie vacataire. Fini les calculs manuels et les erreurs.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: "Import Excel & hors-ligne",
    text: "Importez vos données existantes en un clic. L'application fonctionne même sans connexion et se synchronise automatiquement.",
  },
] as const

const PROBLEMS = [
  {
    title: "Heures professeurs invérifiables",
    text: "Les salaires reposent sur des déclarations ou des feuilles papier non vérifiables. Résultat : paiements inexacts, litiges fréquents, heures fantômes.",
  },
  {
    title: "Absences non signalées à temps",
    text: "Les parents découvrent les absences de leurs enfants plusieurs semaines/mois après les faits. La confiance des familles s'érode.",
  },
  {
    title: "Aucune traçabilité, aucune preuve",
    text: "En cas de contestation, l'établissement n'a aucun historique fiable.",
  },
] as const

const FAQS = [
  {
    question: "« C'est trop cher »",
    answer: "Calculez ce que vous payez en heures non vérifiées chaque mois. Un seul mois d'heures fantômes suffit à couvrir plusieurs mois d'abonnement à IvoirEdu. En plus avec les abonnements parents, vous pouvez même générer des revenus supplémentaires qui couvrent les coûts d'abonnement.",
  },
  {
    question: "« Nous utilisons déjà Excel et WhatsApp »",
    answer: "Excel et WhatsApp ne constitue pas une preuve. Si un prof conteste son nombre d'heures, que montrez-vous ?. Avec IvoirEdu, chaque pointage est horodaté et traçable - ce qui limite les contestations et protège l'établissement en cas de litige. Et ça ne remplace pas WhatsApp, ça le complète : les parents reçoivent des notifications automatiques à chaque absence, sans que vous ayez à faire quoi que ce soit de plus.",
  },
  {
    question: "« Nos enseignants ne sont pas à l'aise avec la technologie »",
    answer: "IvoirEdu ne requiert aucune installation. Il suffit d'une connexion depuis n'importe quel téléphone pour pointer sa présence en quelques secondes. La prise en main et le pointage prennent moins de 5 minutes.",
  },
  {
    question: "« Nos données sont-elles sécurisées ? »",
    answer: "Oui. Chaque établissement dispose d'un espace totalement isolé. Les données sont stockées sur un serveur sécurisé et restent la propriété exclusive de l'établissement.",
  },
  {
    question: "« Et si nous n'avons pas Internet ? »",
    answer: "IvoirEdu fonctionne hors connexion. Les pointages sont enregistrés et synchronisés automatiquement dès que la connexion est rétablie.",
  },
  {
    question: "« Qui s'occupe de la mise en place ? »",
    answer: "L'accompagnement est inclus : import de vos données existantes, configuration des emplois du temps, formation des équipes. Un établissement peut être opérationnel en moins d'une heure.",
  },
  {
    question: "« Le tarif et la commission sont-ils fixés ? »",
    answer: "Non. Le montant d'abonnement proposé aux parents et la commission reversée à votre établissement sont variables et entièrement négociables selon votre contexte et votre volume d'élèves.",
  },
] as const

// ─── Section divider ─────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="ie-divider" aria-hidden="true">
      <span className="ie-divider__line" />
      <span className="ie-divider__label">{label}</span>
      <span className="ie-divider__line" />
    </div>
  )
}

// ─── Dashboard SVG ───────────────────────────────────────────────────────────

function DashboardPreview() {
  return (
    <div className="ie-dashboard" aria-label="Aperçu du tableau de bord IvoirEdu">
        <img src="/dashboardIvoirEdu.png" alt="Aperçu du tableau de bord IvoirEdu" />
    </div>
  )
}

// ─── Navbar ──────────────────────────────────────────────────────────────────

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", handler, { passive: true })
    return () => window.removeEventListener("scroll", handler)
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
    setMenuOpen(false)
  }

  return (
    <header className={`ie-nav${scrolled ? " ie-nav--scrolled" : ""}`}>
      <div className="ie-container">
        <div className="ie-nav__inner">
          {/* Logo */}
          <a href="#" className="ie-nav__logo" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }) }}>
            <span className="ie-nav__logo-mark"><img src="/logo.png" alt="Logo IvoirEdu" /></span>
            
            <span className="ie-nav__logo-text">IvoirEdu</span>
          </a>

          {/* Links */}
          <nav className="ie-nav__links" aria-label="Navigation principale">
            {[
              ["Fonctionnalités", "features"],
              ["Cibles", "forwho"],
              ["Tarification", "pricing"],
              ["FAQ", "faq"],
            ].map(([label, id]) => (
              <button key={id} className="ie-nav__link" onClick={() => scrollTo(id)}>
                {label}
              </button>
            ))}
          </nav>

          {/* CTA */}
          <button className="ie-btn ie-btn--primary ie-nav__cta" onClick={() => scrollTo("demo")}>
            Demander une démo
          </button>

          {/* Hamburger */}
          <button
            className={`ie-hamburger${menuOpen ? " ie-hamburger--open" : ""}`}
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Ouvrir le menu"
            aria-expanded={menuOpen}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="ie-mobile-menu">
          {[
            ["Fonctionnalités", "features"],
            ["Cibles", "forwho"],
            ["Tarification", "pricing"],
            ["FAQ", "faq"],
          ].map(([label, id]) => (
            <button key={id} className="ie-mobile-menu__link" onClick={() => scrollTo(id)}>
              {label}
            </button>
          ))}
          <button className="ie-btn ie-btn--primary" style={{ marginTop: 8 }} onClick={() => scrollTo("demo")}>
            Demander une démo
          </button>
        </div>
      )}
    </header>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })

  return (
    <section className="ie-hero" id="hero">
      <div className="ie-container">
        <div className="ie-hero__grid">
          {/* Copy */}
          <div className="ie-hero__copy">
            <div className="ie-badge">
              <span className="ie-badge__dot" />
              Plateforme scolaire · Côte d'Ivoire
            </div>

            <h1 className="ie-hero__heading">
              Gérez votre établissement avec{" "}
              <span className="ie-hero__accent">clarté</span>{" "}
              et confiance
            </h1>

            <p className="ie-hero__sub">
              IvoirEdu centralise la gestion des présences enseignants et élèves, automatise le calcul des heures de cours et tient les parents informés en temps réel.
            </p>

            <div className="ie-hero__actions">
              <button className="ie-btn ie-btn--primary ie-btn--lg" onClick={() => scrollTo("demo")}>
                Démo gratuite
              </button>
              <button className="ie-btn ie-btn--outline ie-btn--lg" onClick={() => scrollTo("features")}>
                Voir les fonctionnalités
              </button>
            </div>

            <div className="ie-hero__proof">
              {[
                "Aucun frais d'installation",
                "Fonctionne hors connexion",
              ].map(item => (
                <span key={item} className="ie-proof-chip">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Visual */}
          <div className="ie-hero__visual">
            <DashboardPreview />
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Problems ────────────────────────────────────────────────────────────────

function Problems() {
  return (
        <section className="ie-section ie-section--alt" id="problems">
        <div className="ie-container">
            <SectionDivider label="Le constat" />
            <div className="ie-section__head">
            <h2>Ce que vivent la plupart des établissements privés</h2>
            <p>Des problèmes concrets, avec des conséquences financières réelles.</p>
            </div>
            <div className="ie-grid-3">
            {PROBLEMS.map(({ title, text }) => (
                <article className="ie-problem-card" key={title}>
                <div className="ie-problem-card__icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="#DC2626" strokeWidth="2"/>
                    <path d="M12 8v4M12 16h.01" stroke="#DC2626" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                </article>
            ))}
            </div>
        </div>
        </section>
    )
}

// ─── Features ────────────────────────────────────────────────────────────────

function Features() {
  return (
    <section className="ie-section" id="features">
      <div className="ie-container">
        <SectionDivider label="La solution" />
        <div className="ie-section__head">
          <h2>IvoirEdu répond à chacun de ces problèmes</h2>
          <p>Une suite de fonctionnalités pensée pour la réalité des établissements ivoiriens.</p>
        </div>
        <div className="ie-grid-3">
          {FEATURES.map(({ icon, title, text }) => (
            <article className="ie-feature-card" key={title}>
              <div className="ie-feature-card__icon">{icon}</div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── For Who ─────────────────────────────────────────────────────────────────

function ForWho() {
  return (
    <section className="ie-section ie-section--alt" id="forwho">
      <div className="ie-container">
        <SectionDivider label="Cibles" />
        <div className="ie-section__head">
          <h2>Conçu pour les établissements privés qui veulent progresser</h2>
        </div>
        <div className="ie-grid-3">
          <div className="ie-forwho-card">
            <div className="ie-forwho-card__tag">Décideurs</div>
            <h3>Direction & administration</h3>
            <ul>
              <li>Directeurs d'établissement</li>
              <li>Promoteurs et propriétaires d'écoles privées</li>
              <li>Responsables administratifs</li>
            </ul>
          </div>
          <div className="ie-forwho-card">
            <div className="ie-forwho-card__tag">Établissements</div>
            <h3>Tous types de structures</h3>
            <ul>
              <li>Écoles, collèges et lycées privés</li>
              <li>Centres de formation professionnelle</li>
              <li>Tout établissement avec enseignants vacataires</li>
            </ul>
          </div>
          <div className="ie-forwho-card">
            <div className="ie-forwho-card__tag">Bénéficiaires</div>
            <h3>Familles & enseignants</h3>
            <ul>
              <li>Parents souhaitant suivre l'assiduité de leurs enfants en temps réel</li>
              <li>Enseignants qui veulent des preuves fiables de leur travail</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Comparison ──────────────────────────────────────────────────────────────

function Comparison() {
  const before = [
    "Heures de cours difficilement vérifiables et facilement contestables",
    "Paiement basé sur la confiance et les déclarations",
    "Gestion manuelle et papier des absences (sans alertes aux parents)",
    "Risques de conflits avec les vacataires",
    "Fichiers Excel éparpillés sur plusieurs appareils",
    "Aucune traçabilité en cas de litige",
  ]
  const after = [
    "Paiement basé sur les heures réellement effectuées",
    "Réduction des fraudes et erreurs de calcul",
    "Notifications automatiques aux parents à chaque absence",
    "Historique complet, consultable à tout moment",
    "Données centralisées et fiables en un seul endroit",
    "Meilleure image et crédibilité de l'établissement",
  ]

  return (
    <section className="ie-section" id="comparison">
      <div className="ie-container">
        <SectionDivider label="Comparaison" />
        <div className="ie-section__head">
          <h2>IvoirEdu fait la différence en un coup d'œil</h2>
        </div>
        <div className="ie-comparison">
          <div className="ie-comparison__col ie-comparison__col--before">
            <div className="ie-comparison__head">
              <span className="ie-comparison__icon ie-comparison__icon--red">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
              </span>
              Sans IvoirEdu
            </div>
            <ul>
              {before.map(item => (
                <li key={item}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round"/></svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="ie-comparison__col ie-comparison__col--after">
            <div className="ie-comparison__head">
              <span className="ie-comparison__icon ie-comparison__icon--green">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
              Avec IvoirEdu
            </div>
            <ul>
              {after.map(item => (
                <li key={item}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 6L9 17l-5-5" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Pricing ─────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <section className="ie-section ie-section--alt" id="pricing">
      <div className="ie-container">
        <SectionDivider label="Modèle économique" />
        <div className="ie-section__head">
          <h2>Un modèle qui peut vous rapporter</h2>
          <p>Des revenus peuvent être générés par les abonnements parents au module de Notification.</p>
        </div>

        {/* Model breakdown */}
        <div className="ie-pricing-model">
          <div className="ie-pricing-model__item">
            <span className="ie-pricing-model__label">Montant abonnement parent / mois</span>
            <span className="ie-pricing-model__amount ie-pricing-model__amount--blue">Variable</span>
            <p>Le tarif proposé aux parents est ajustable selon votre établissement et votre contexte. Exemple de référence : 1 000 FCFA / élève.</p>
          </div>
          <div className="ie-pricing-model__item">
            <span className="ie-pricing-model__label">Commission reversée à l'école</span>
            <span className="ie-pricing-model__amount ie-pricing-model__amount--green">Négociable</span>
            <p>La part reversée à votre établissement sur chaque abonnement est discutée ensemble et adaptée à votre volume d'élèves.</p>
          </div>
          <div className="ie-pricing-model__item">
            <span className="ie-pricing-model__label">À IvoirEdu</span>
            <span className="ie-pricing-model__amount ie-pricing-model__amount--muted">Le reste</span>
            <p>Pour l'exploitation, le support technique et le développement continu de la plateforme.</p>
          </div>
        </div>

        {/* Example */}
        <div className="ie-pricing-example">
          <div className="ie-pricing-example__header">
            Exemple concret - 300 élèves abonnés à 1 000 FCFA
          </div>
          {[
            { label: "Total montant abonnement collecté", value: "300 000 FCFA / mois", highlight: false },
            { label: "Part IvoirEdu (70% dans cet exemple)", value: "210 000 FCFA", highlight: false },
            { label: "Part de votre établissement (30% dans cet exemple)", value: "90 000 FCFA / mois", highlight: true },
          ].map(({ label, value, highlight }) => (
            <div className="ie-pricing-example__row" key={label}>
              <span>{label}</span>
              <span className={highlight ? "ie-pricing-example__highlight" : ""}>{value}</span>
            </div>
          ))}
          <p className="ie-pricing-example__note">
            Le montant d'abonnement et la commission sont variables et entièrement négociables selon votre établissement.
          </p>
        </div>

         {/* Launch offer */}
        <div className="ie-launch-offer">
          <span className="ie-launch-offer__badge">Offre de lancement</span>
          <h3>Les 5 premiers établissements partenaires bénéficient d'un accès entièrement gratuit à IvoirEdu.</h3>
          <p>Rejoignez les premières écoles ivoiriennes à digitaliser leur gestion scolaire sans aucun investissement initial.</p>
          <div className="ie-launch-offer__perks">
            {["Aucun abonnement mensuel","Aucun frais d'installation", "Aucun coût de maintenance", "Aucun frais de licence" ].map(p => (
              <span key={p}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 6L9 17l-5-5" stroke="#1B4FD8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

function FAQ() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section className="ie-section" id="faq">
      <div className="ie-container">
        <SectionDivider label="Questions fréquentes" />
        <div className="ie-section__head">
          <h2>Vos questions, nos réponses</h2>
        </div>
        <div className="ie-faq">
          {FAQS.map(({ question, answer }, i) => (
            <article className={`ie-faq__item${open === i ? " ie-faq__item--open" : ""}`} key={question}>
              <button
                className="ie-faq__question"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                <span>{question}</span>
                <svg className="ie-faq__chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {open === i && (
                <div className="ie-faq__answer">
                  {answer}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Demo Form ───────────────────────────────────────────────────────────────

type FormState = {
  nom: string; etablissement: string; fonction: string
  telephone: string; email: string; ville: string; message: string
}

function DemoForm() {
  const [form, setForm] = useState<FormState>({
    nom: "", etablissement: "", fonction: "", telephone: "", email: "", ville: "", message: ""
  })
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.nom || !form.etablissement || !form.telephone || !form.email) {
      setErrorMsg("Veuillez remplir les champs obligatoires (nom, établissement, téléphone, email).")
      return
    }
    setErrorMsg("")
    setStatus("loading")
    // EmailJS integration point - remplacer VOTRE_CLE, VOTRE_SERVICE_ID, VOTRE_TEMPLATE_ID
    try {
      if (typeof (window as any).emailjs !== "undefined") {
        await (window as any).emailjs.send(
          "VOTRE_SERVICE_ID",
          "VOTRE_TEMPLATE_ID",
          { ...form }
        )
      }
      setStatus("success")
    } catch {
      setStatus("error")
      setErrorMsg("Une erreur est survenue. Contactez-nous directement à contact@ivoiredu.ci")
    }
  }

  return (
    <section className="ie-section ie-section--alt" id="demo">
      <div className="ie-container">
        <SectionDivider label="Démo gratuite" />
        <div className="ie-section__head">
          <h2>Demandez votre démonstration gratuite</h2>
          <p>Remplissez ce formulaire. Notre équipe vous contacte sous 24h pour organiser une démo de 20 minutes, sans engagement.</p>
        </div>

        <div className="ie-demo-grid">
          {/* Form */}
          <div className="ie-form-card">
            {status === "success" ? (
              <div className="ie-form-success">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="#059669" strokeWidth="2"/>
                  <path d="M8 12l3 3 5-5" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <h3>Demande envoyée !</h3>
                <p>Nous vous contacterons sous 24h pour organiser votre démonstration.</p>
              </div>
            ) : (
              <>
                {errorMsg && <div className="ie-form-error" role="alert">{errorMsg}</div>}
                {status === "error" && !errorMsg && (
                  <div className="ie-form-error" role="alert">
                    Une erreur est survenue. Contactez-nous à <strong>contact@ivoiredu.ci</strong>
                  </div>
                )}

                <div className="ie-form-row">
                  <label className="ie-form-label">
                    Nom et prénom *
                    <input className="ie-form-input" type="text" value={form.nom} onChange={set("nom")} placeholder="Jean Kouassi" required />
                  </label>
                  <label className="ie-form-label">
                    Nom de l'établissement *
                    <input className="ie-form-input" type="text" value={form.etablissement} onChange={set("etablissement")} placeholder="École Sainte-Marie" required />
                  </label>
                </div>

                <label className="ie-form-label">
                  Votre fonction
                  <select className="ie-form-input" value={form.fonction} onChange={set("fonction")}>
                    <option value="">Sélectionner…</option>
                    <option value="Directeur/trice">Directeur/trice</option>
                    <option value="Promoteur/Propriétaire">Promoteur / Propriétaire</option>
                    <option value="Responsable administratif">Responsable administratif</option>
                    <option value="Autre">Autre</option>
                  </select>
                </label>

                <div className="ie-form-row">
                  <label className="ie-form-label">
                    Téléphone *
                    <input className="ie-form-input" type="tel" value={form.telephone} onChange={set("telephone")} placeholder="+225 07 00 00 00 00" required />
                  </label>
                  <label className="ie-form-label">
                    Email *
                    <input className="ie-form-input" type="email" value={form.email} onChange={set("email")} placeholder="jean@ecole.ci" required />
                  </label>
                </div>

                <label className="ie-form-label">
                  Ville
                  <input className="ie-form-input" type="text" value={form.ville} onChange={set("ville")} placeholder="Abidjan, Bouaké…" />
                </label>

                <label className="ie-form-label">
                  Questions ou précisions (facultatif)
                  <textarea className="ie-form-input ie-form-textarea" value={form.message} onChange={set("message")} placeholder="Nombre d'élèves, spécificités de votre établissement…" />
                </label>

                <button
                  className="ie-btn ie-btn--primary ie-btn--full"
                  onClick={handleSubmit}
                  disabled={status === "loading"}
                >
                  {status === "loading" ? (
                    <><span className="ie-spinner" aria-hidden="true" /> Envoi en cours…</>
                  ) : "Envoyer ma demande de démo"}
                </button>
              </>
            )}
          </div>

          {/* Sidebar info */}
          <div className="ie-demo-info">
            <div className="ie-demo-info__block">
              <h3>Nous contacter directement</h3>
              <div className="ie-demo-contact">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2"/><path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="2"/></svg>
                <span>contact@ivoiredu.ci</span>
              </div>
              <div className="ie-demo-contact">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.57 3.38 2 2 0 0 1 3.55 1.2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 7.1 7.1l1.87-1.87a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" stroke="currentColor" strokeWidth="2"/></svg>
                <span>Disponible sur WhatsApp</span>
              </div>
              <div className="ie-demo-contact">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                <span>Réponse sous 24h ouvrées</span>
              </div>
            </div>

            <div className="ie-demo-info__guarantee">
              <p className="ie-demo-info__guarantee-title">Votre démo, sans prise de tête</p>
              <ul>
                <li>Démo de 20 minutes</li>
                <li>Sans engagement de votre part</li>
                <li>Entièrement gratuite</li>
                <li>Adaptée à votre établissement</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })

  return (
    <footer className="ie-footer">
      <div className="ie-container">
        <div className="ie-footer__grid">
          <div>
            <div className="ie-footer__brand">
              <span className="ie-nav__logo-mark"><img src="/logo.png" alt="Logo IvoirEdu" /></span>
              <span>IvoirEdu</span>
            </div>
            <p>Plateforme de gestion scolaire pour établissements privés en Côte d'Ivoire. Présences, salaires vacataires, communication parents - centralisés.</p>
          </div>

          <nav>
            <h4>Navigation</h4>
            <ul>
              {[["Fonctionnalités", "features"], ["Cibles", "forwho"], ["Tarification", "pricing"], ["FAQ", "faq"]].map(([label, id]) => (
                <li key={id}><button onClick={() => scrollTo(id)}>{label}</button></li>
              ))}
            </ul>
          </nav>

          <div>
            <h4>Contact</h4>
            <ul>
              <li><button onClick={() => scrollTo("demo")}>Demander une démo</button></li>
              <li><a href="mailto:contact@ivoiredu.ci">contact@ivoiredu.ci</a></li>
              <li><a href="#">WhatsApp</a></li>
            </ul>
          </div>
        </div>

        <div className="ie-footer__bottom">
          © 2025 IvoirEdu - Plateforme de gestion scolaire pour établissements privés en Côte d'Ivoire
        </div>
      </div>
    </footer>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function MarketingHomePage() {
  return (
    <div className="ie-root">
      <Navbar />
      <main>
        <Hero />
        <Problems />
        <Features />
        <ForWho />
        <Comparison />
        <Pricing />
        <FAQ />
        <DemoForm />
      </main>
      <Footer />
    </div>
  )
}