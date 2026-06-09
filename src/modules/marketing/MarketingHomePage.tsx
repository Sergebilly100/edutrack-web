import { useMemo, useState, type FormEvent } from "react"
import { Bell, CheckCircle2, ChevronDown, Clock, FileSpreadsheet, MessageSquare, ShieldCheck, Smartphone, Users } from "lucide-react"

import "./marketing-home.css"

type DemoFormState = {
  name: string
  school: string
  role: string
  phone: string
  email: string
  city: string
  message: string
}

const initialForm: DemoFormState = {
  name: "",
  school: "",
  role: "",
  phone: "",
  email: "",
  city: "",
  message: "",
}

const features = [
  {
    icon: Clock,
    title: "Pointage des enseignants",
    text: "Chaque présence est horodatée et rattachée à un cours planifié. Les heures vacataires deviennent vérifiables.",
  },
  {
    icon: Users,
    title: "Suivi des élèves",
    text: "Appel par classe, historique complet et statistiques de fréquentation accessibles au directeur.",
  },
  {
    icon: Bell,
    title: "Alertes parents",
    text: "Les parents reçoivent les absences par SMS, e-mail ou notification push selon la configuration de l'école.",
  },
  {
    icon: ShieldCheck,
    title: "Preuves fiables",
    text: "QR salle, horodatage et historique centralisé limitent les litiges sur les cours effectués.",
  },
  {
    icon: FileSpreadsheet,
    title: "Import Excel",
    text: "Les élèves, enseignants et emplois du temps existants sont importés sans ressaisie massive.",
  },
  {
    icon: Smartphone,
    title: "PWA hors connexion",
    text: "L'application reste utilisable sur Android basique et synchronise les actions dès le retour réseau.",
  },
] as const

const faqs = [
  {
    question: "IvoirEdu remplace-t-il tout notre système actuel ?",
    answer: "La démo commence par les flux critiques : présences, salaires vacataires et alertes parents. Le déploiement peut ensuite être progressif.",
  },
  {
    question: "Faut-il installer une application depuis un store ?",
    answer: "Non. IvoirEdu est une PWA : elle s'ouvre depuis le navigateur et peut être ajoutée à l'écran d'accueil.",
  },
  {
    question: "Le tarif parent est-il forcément 1 000 FCFA ?",
    answer: "Non. Le montant affiché est un exemple de référence. Le tarif parent et la commission sont ajustables selon l'établissement et le volume.",
  },
  {
    question: "Les données de chaque école sont-elles isolées ?",
    answer: "Oui. Chaque établissement dispose de son propre espace isolé par schéma tenant.",
  },
] as const

export default function MarketingHomePage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)
  const [form, setForm] = useState<DemoFormState>(initialForm)
  const [submitted, setSubmitted] = useState(false)

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent(`Demande de démo IvoirEdu - ${form.school || "Établissement"}`)
    const body = encodeURIComponent(
      [
        `Nom : ${form.name}`,
        `Établissement : ${form.school}`,
        `Fonction : ${form.role || "-"}`,
        `Téléphone : ${form.phone}`,
        `Email : ${form.email}`,
        `Ville : ${form.city || "-"}`,
        "",
        form.message || "Je souhaite planifier une démonstration IvoirEdu.",
      ].join("\n")
    )
    return `mailto:contact@ivoiredu.ci?subject=${subject}&body=${body}`
  }, [form])

  const updateField = (field: keyof DemoFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim() || !form.school.trim() || !form.phone.trim() || !form.email.trim()) {
      return
    }
    window.location.href = mailtoHref
    setSubmitted(true)
  }

  return (
    <div className="marketing-page">
      <header className="marketing-nav">
        <div className="marketing-container marketing-nav-inner">
          <a className="marketing-logo" href="#hero" aria-label="Accueil IvoirEdu">
            <img src="/logo.png" alt="Logo IvoirEdu" />
            <span>IvoirEdu</span>
          </a>
          <nav className="marketing-links" aria-label="Navigation principale">
            <a href="#features">Fonctionnalités</a>
            <a href="#audience">Pour qui</a>
            <a href="#pricing">Modèle économique</a>
            <a href="#faq">FAQ</a>
          </nav>
          <a className="marketing-btn marketing-btn-primary marketing-nav-cta" href="#demo">Demander une démo</a>
          <button
            type="button"
            className="marketing-menu-btn"
            aria-label="Ouvrir le menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
        {menuOpen ? (
          <div className="marketing-mobile-menu">
            <a href="#features" onClick={() => setMenuOpen(false)}>Fonctionnalités</a>
            <a href="#audience" onClick={() => setMenuOpen(false)}>Pour qui</a>
            <a href="#pricing" onClick={() => setMenuOpen(false)}>Modèle économique</a>
            <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
            <a className="marketing-btn marketing-btn-primary" href="#demo" onClick={() => setMenuOpen(false)}>Demander une démo</a>
          </div>
        ) : null}
      </header>

      <main>
        <section id="hero" className="marketing-hero">
          <div className="marketing-container marketing-hero-grid">
            <div>
              <p className="marketing-kicker">Plateforme scolaire, Côte d'Ivoire</p>
              <h1>Gérez votre établissement avec clarté et confiance</h1>
              <p className="marketing-hero-copy">
                IvoirEdu centralise les présences enseignants et élèves, sécurise les heures vacataires et tient les parents informés en temps réel.
              </p>
              <div className="marketing-actions">
                <a className="marketing-btn marketing-btn-primary" href="#demo">Demander une démo gratuite</a>
                <a className="marketing-btn marketing-btn-secondary" href="#features">Voir les fonctionnalités</a>
              </div>
              <div className="marketing-proof-row">
                <span><CheckCircle2 /> Sans frais d'installation</span>
                <span><CheckCircle2 /> Mise en service rapide</span>
                <span><CheckCircle2 /> Fonctionne hors connexion</span>
              </div>
            </div>

            <div className="marketing-dashboard" aria-label="Aperçu du tableau de bord IvoirEdu">
              <div className="marketing-dashboard-top">
                <span />
                <span />
                <span />
                <strong>Tableau de bord</strong>
              </div>
              <div className="marketing-dashboard-body">
                <div className="marketing-sidebar-preview">
                  <span className="active">Dashboard</span>
                  <span>Présences</span>
                  <span>Enseignants</span>
                  <span>Parents</span>
                  <span>Salaires</span>
                </div>
                <div className="marketing-dashboard-main">
                  <p className="marketing-dashboard-title">Résumé du jour</p>
                  <div className="marketing-metrics">
                    <div><small>Présence</small><strong>94%</strong></div>
                    <div><small>Heures</small><strong>127h</strong></div>
                    <div><small>Alertes</small><strong>312</strong></div>
                  </div>
                  <div className="marketing-progress-block">
                    <div><span>6ème A</span><b style={{ width: "92%" }} /></div>
                    <div><span>Terminale C</span><b style={{ width: "96%" }} /></div>
                    <div><span>3ème B</span><b style={{ width: "78%" }} /></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="marketing-band">
          <div className="marketing-container marketing-section-head">
            <p className="marketing-section-label">Le constat</p>
            <h2>Des pertes réelles quand les présences ne sont pas prouvées</h2>
            <p>Heures vacataires invérifiables, absences découvertes trop tard, fichiers dispersés : IvoirEdu cible ces problèmes concrets.</p>
          </div>
        </section>

        <section id="features" className="marketing-section">
          <div className="marketing-container">
            <div className="marketing-section-head">
              <p className="marketing-section-label">La solution</p>
              <h2>Une suite pensée pour la réalité des écoles ivoiriennes</h2>
            </div>
            <div className="marketing-feature-grid">
              {features.map((feature) => {
                const Icon = feature.icon
                return (
                  <article key={feature.title} className="marketing-feature">
                    <span><Icon /></span>
                    <h3>{feature.title}</h3>
                    <p>{feature.text}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section id="audience" className="marketing-band">
          <div className="marketing-container marketing-audience-grid">
            <div>
              <p className="marketing-section-label">Pour qui</p>
              <h2>Les établissements privés qui veulent mieux piloter leur quotidien</h2>
            </div>
            <ul>
              <li>Directeurs, promoteurs et responsables administratifs.</li>
              <li>Écoles, collèges, lycées privés et centres de formation.</li>
              <li>Structures avec enseignants vacataires et besoin de preuves fiables.</li>
            </ul>
          </div>
        </section>

        <section id="pricing" className="marketing-section">
          <div className="marketing-container">
            <div className="marketing-section-head">
              <p className="marketing-section-label">Modèle économique</p>
              <h2>Un modèle ajustable, transparent et négociable</h2>
              <p>
                L'exemple à 1 000 FCFA par élève et par mois sert de base de discussion. Le montant final, les remises volume et les pourcentages de commission sont négociables selon l'école.
              </p>
            </div>

            <div className="marketing-pricing-note">
              <strong>Offre de lancement</strong>
              <span>Les premiers établissements partenaires bénéficient d'un accompagnement sans frais d'installation ni licence initiale.</span>
            </div>

            <div className="marketing-pricing-grid">
              <div>
                <strong>À partir de 1 000 FCFA</strong>
                <span>Montant parent indicatif, variable selon le service, le volume et l'accord commercial.</span>
              </div>
              <div>
                <strong>Commission école négociable</strong>
                <span>La part reversée à l'établissement peut être adaptée au partenariat.</span>
              </div>
              <div>
                <strong>Commission IvoirEdu négociable</strong>
                <span>Elle couvre l'exploitation, le support, l'hébergement et les évolutions produit.</span>
              </div>
            </div>

            <div className="marketing-example">
              <h3>Exemple indicatif, 300 élèves abonnés</h3>
              <div><span>Total collecté à 1 000 FCFA</span><strong>300 000 FCFA / mois</strong></div>
              <div><span>Part école si commission négociée à 30%</span><strong>90 000 FCFA / mois</strong></div>
              <p>Ces chiffres ne sont pas contractuels. Ils servent à cadrer la démo et la discussion commerciale.</p>
            </div>
          </div>
        </section>

        <section id="faq" className="marketing-band">
          <div className="marketing-container">
            <div className="marketing-section-head">
              <p className="marketing-section-label">Questions fréquentes</p>
              <h2>Les réponses avant la démo</h2>
            </div>
            <div className="marketing-faq-list">
              {faqs.map((item, index) => (
                <article key={item.question} className={openFaq === index ? "open" : ""}>
                  <button type="button" onClick={() => setOpenFaq((current) => current === index ? -1 : index)}>
                    <span>{item.question}</span>
                    <ChevronDown />
                  </button>
                  {openFaq === index ? <p>{item.answer}</p> : null}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="demo" className="marketing-section">
          <div className="marketing-container marketing-demo-grid">
            <div>
              <p className="marketing-section-label">Démo gratuite</p>
              <h2>Demandez une démonstration adaptée à votre établissement</h2>
              <p>
                Laissez vos coordonnées. Le formulaire prépare un e-mail de demande de démo avec les informations utiles pour vous recontacter.
              </p>
              <div className="marketing-contact-card">
                <MessageSquare />
                <div>
                  <strong>Contact direct</strong>
                  <a href="mailto:contact@ivoiredu.ci">contact@ivoiredu.ci</a>
                </div>
              </div>
            </div>

            <form className="marketing-form" onSubmit={handleSubmit}>
              {submitted ? (
                <div className="marketing-success" role="status">
                  <CheckCircle2 />
                  <strong>Votre demande est prête.</strong>
                  <span>Votre client e-mail s'est ouvert avec les informations de démo.</span>
                </div>
              ) : null}
              <div className="marketing-form-row">
                <label>
                  Nom et prénom *
                  <input required value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Jean Kouassi" />
                </label>
                <label>
                  Établissement *
                  <input required value={form.school} onChange={(event) => updateField("school", event.target.value)} placeholder="École Sainte-Marie" />
                </label>
              </div>
              <label>
                Fonction
                <select value={form.role} onChange={(event) => updateField("role", event.target.value)}>
                  <option value="">Sélectionner</option>
                  <option value="Directeur/trice">Directeur/trice</option>
                  <option value="Promoteur/Propriétaire">Promoteur / Propriétaire</option>
                  <option value="Responsable administratif">Responsable administratif</option>
                  <option value="Autre">Autre</option>
                </select>
              </label>
              <div className="marketing-form-row">
                <label>
                  Téléphone *
                  <input required type="tel" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="+225 07 00 00 00 00" />
                </label>
                <label>
                  Email *
                  <input required type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder="contact@ecole.ci" />
                </label>
              </div>
              <label>
                Ville
                <input value={form.city} onChange={(event) => updateField("city", event.target.value)} placeholder="Abidjan" />
              </label>
              <label>
                Précisions
                <textarea value={form.message} onChange={(event) => updateField("message", event.target.value)} placeholder="Nombre d'élèves, besoin prioritaire..." />
              </label>
              <button className="marketing-btn marketing-btn-primary" type="submit">Envoyer ma demande de démo</button>
            </form>
          </div>
        </section>
      </main>

      <footer className="marketing-footer">
        <div className="marketing-container">
          <div className="marketing-footer-brand">
            <img src="/logo.png" alt="Logo IvoirEdu" />
            <span>IvoirEdu</span>
          </div>
          <p>Plateforme de gestion scolaire pour établissements privés en Côte d'Ivoire.</p>
          <small>© 2026 IvoirEdu</small>
        </div>
      </footer>
    </div>
  )
}
