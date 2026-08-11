// DynamicSEO.tsx - Dynamic SEO component for meta tags and structured data
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applySeo, type SeoConfig } from '../features/seo/applySeo';

const SEO_CONFIGS: Record<string, SeoConfig> = {
  '/': {
    title: 'German Learning Modules - Vocabulary, Grammar, Speaking & More | Langey',
    description: 'Choose from Langey German learning modules for vocabulary, grammar, speaking, writing, reading, and listening. Practice A1 to B1 German skills in one structured app.',
    keywords: 'german learning modules, german vocabulary module, german grammar module, german speaking practice, german writing practice, german reading practice, german listening practice, A1 A2 B1 german',
    canonical: 'https://app.langey.com/',
    ogTitle: 'German Learning Modules - Practice All Six Skills | Langey',
    ogDescription: 'Practice German vocabulary, grammar, speaking, writing, reading, and listening from A1 to B1 in one app.',
    ogImage: 'https://app.langey.com/favicon.png',
    twitterImage: 'https://app.langey.com/favicon.png',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Langey German Learning Modules",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web",
      "description": "German learning modules for vocabulary, grammar, speaking, writing, reading, and listening practice across A1, A2, and B1 levels.",
      "url": "https://app.langey.com",
      "sameAs": ["https://app.langey.com"],
      "inLanguage": "en",
      "teaches": "German Language",
      "educationalLevel": ["A1", "A2", "B1"],
      "featureList": [
        "German vocabulary practice",
        "German grammar exercises",
        "German speaking scenarios",
        "German writing correction",
        "German reading comprehension",
        "German listening comprehension"
      ],
      "offers": {
        "@type": "Offer",
        "price": "4.99",
        "priceCurrency": "USD",
        "priceSpecification": {
          "@type": "UnitPriceSpecification",
          "price": "4.99",
          "priceCurrency": "USD",
          "billingDuration": "P1M",
          "billingIncrement": "P1M"
        },
        "description": "German language learning subscription with interactive lessons and AI-powered feedback - $4.99 per month"
      }
    }
  },
  '/vocabulary': {
    title: 'German Vocabulary Practice - Learn German Words with Flashcards | Langey',
    description: 'Master German vocabulary with interactive flashcards and spaced repetition. Learn German words, pronunciation with audio, and build your German vocabulary fast. 6000+ German words across A1, A2, B1 levels.',
    keywords: 'german vocabulary, learn german words, german flashcards, german vocabulary practice, german vocabulary builder, spaced repetition german, german pronunciation, learn german vocabulary, german words with audio, german vocabulary app',
    canonical: 'https://app.langey.com/vocabulary',
    ogTitle: 'German Vocabulary Practice - Learn 6000+ German Words | Langey',
    ogDescription: 'Master German vocabulary with AI-powered flashcards, spaced repetition, and audio pronunciation. Learn German words effectively!',
    ogImage: 'https://app.langey.com/favicon.png',
    twitterImage: 'https://app.langey.com/favicon.png',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Langey German Vocabulary Practice",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web",
      "description": "Interactive German vocabulary learning with flashcards, spaced repetition, and audio pronunciation for A1, A2, and B1 levels.",
      "url": "https://app.langey.com/vocabulary",
      "offers": {
        "@type": "Offer",
        "price": "4.99",
        "priceCurrency": "USD",
        "priceSpecification": {
          "@type": "UnitPriceSpecification",
          "price": "4.99",
          "priceCurrency": "USD",
          "billingDuration": "P1M",
          "billingIncrement": "P1M"
        }
      },
      "featureList": [
        "German vocabulary flashcards",
        "Spaced repetition learning system",
        "Audio pronunciation for German words",
        "6000+ German vocabulary words",
        "Progress tracking for vocabulary",
        "German vocabulary by proficiency level",
        "Interactive word practice",
        "German word memorization tools"
      ],
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "ratingCount": "3056"
      }
    }
  },
  '/grammar': {
    title: 'German Grammar Exercises Online - Practice German Grammar | Langey',
    description: 'Practice German grammar with interactive exercises and AI feedback. Master German grammar rules with 100+ topics across A1, A2, B1 levels. Free German grammar practice online with instant corrections.',
    keywords: 'german grammar exercises, practice german grammar, german grammar online, german grammar rules, interactive german grammar, german grammar practice, learn german grammar, german grammar exercises online, german grammar drills, german grammar worksheets',
    canonical: 'https://app.langey.com/grammar',
    ogTitle: 'German Grammar Exercises - Practice 100+ Grammar Topics | Langey',
    ogDescription: 'Master German grammar with interactive exercises, AI feedback, and comprehensive grammar rules. Practice German grammar online free!',
    ogImage: 'https://app.langey.com/favicon.png',
    twitterImage: 'https://app.langey.com/favicon.png',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Langey German Grammar Practice",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web",
      "description": "Comprehensive German grammar exercises with interactive practice, AI-powered feedback, and 100+ grammar topics for A1, A2, and B1 levels.",
      "url": "https://app.langey.com/grammar",
      "offers": {
        "@type": "Offer",
        "price": "4.99",
        "priceCurrency": "USD",
        "priceSpecification": {
          "@type": "UnitPriceSpecification",
          "price": "4.99",
          "priceCurrency": "USD",
          "billingDuration": "P1M",
          "billingIncrement": "P1M"
        }
      },
      "featureList": [
        "German grammar exercises online",
        "Interactive German grammar practice",
        "AI-powered grammar feedback",
        "100+ German grammar topics",
        "Fill-in-the-blank exercises",
        "Multiple choice grammar tests",
        "Sentence building practice",
        "German grammar rules explained",
        "Progress tracking for grammar"
      ],
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "ratingCount": "3056"
      }
    }
  },
  '/speaking': {
    title: 'German Speaking Practice - AI Conversation Scenarios | Langey',
    description: 'Practice spoken German with AI-powered conversation scenarios. Improve German pronunciation, fluency, and speaking confidence with interactive roleplay prompts for A1, A2, and B1.',
    keywords: 'german speaking practice, practice speaking german, german conversation practice, german pronunciation practice, learn german speaking, german speaking exercises, german speaking with ai, german roleplay practice, spoken german practice online, improve german fluency',
    canonical: 'https://app.langey.com/speaking',
    ogTitle: 'German Speaking Practice - AI Conversation Scenarios | Langey',
    ogDescription: 'Practice spoken German with AI conversation scenarios. Build fluency and confidence with interactive speaking prompts.',
    ogImage: 'https://app.langey.com/favicon.png',
    twitterImage: 'https://app.langey.com/favicon.png',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Langey German Speaking Practice",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web",
      "description": "AI-powered German speaking practice with interactive conversation scenarios for A1, A2, and B1 learners.",
      "url": "https://app.langey.com/speaking",
      "inLanguage": "en",
      "teaches": "German Language",
      "educationalLevel": ["A1", "A2", "B1"],
      "offers": {
        "@type": "Offer",
        "price": "4.99",
        "priceCurrency": "USD",
        "priceSpecification": {
          "@type": "UnitPriceSpecification",
          "price": "4.99",
          "priceCurrency": "USD",
          "billingDuration": "P1M",
          "billingIncrement": "P1M"
        }
      },
      "featureList": [
        "German conversation scenarios",
        "AI speaking partner",
        "Pronunciation practice",
        "Speaking fluency training",
        "Roleplay prompts for real-life situations",
        "Interactive speaking exercises"
      ]
    }
  },
  '/writing': {
    title: 'German Writing Practice - AI-Powered Text Correction | Langey',
    description: 'Practice written German with AI-powered correction and feedback. Improve German writing skills, grammar, vocabulary, and sentence structure for A1, A2, and B1 levels. Get instant corrections and detailed weak point analysis.',
    keywords: 'german writing practice, practice german writing, german writing exercises, german text correction, german writing skills, learn german writing, german writing online, german grammar correction, german writing feedback, improve german writing, german writing for beginners, german composition practice',
    canonical: 'https://app.langey.com/writing',
    ogTitle: 'German Writing Practice - AI-Powered Text Correction | Langey',
    ogDescription: 'Practice written German with AI-powered correction and feedback. Improve your German writing skills with instant corrections and detailed analysis.',
    ogImage: 'https://app.langey.com/favicon.png',
    twitterImage: 'https://app.langey.com/favicon.png',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Langey German Writing Practice",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web",
      "description": "AI-powered German writing practice with instant text correction, grammar feedback, and weak point analysis for A1, A2, and B1 learners.",
      "url": "https://app.langey.com/writing",
      "inLanguage": "en",
      "teaches": "German Language",
      "educationalLevel": ["A1", "A2", "B1"],
      "offers": {
        "@type": "Offer",
        "price": "4.99",
        "priceCurrency": "USD",
        "priceSpecification": {
          "@type": "UnitPriceSpecification",
          "price": "4.99",
          "priceCurrency": "USD",
          "billingDuration": "P1M",
          "billingIncrement": "P1M"
        }
      },
      "featureList": [
        "German text correction",
        "AI-powered writing feedback",
        "Grammar and vocabulary analysis",
        "Weak point identification",
        "Writing skill improvement",
        "German composition practice",
        "Instant error correction",
        "Writing exercises for all levels"
      ],
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "ratingCount": "3056"
      }
    }
  },
  '/reading': {
    title: 'German Reading Practice - Comprehension Exercises A1 A2 B1 | Langey',
    description: 'Practice German reading comprehension with interactive exercises. Improve German reading skills with passages, fill-in-the-blank, true/false, and multiple choice exercises for A1, A2, B1 levels. Free German reading practice online with vocabulary support.',
    keywords: 'german reading practice, german reading comprehension, german reading exercises, practice german reading, german reading online, learn german reading, german reading passages, german comprehension exercises, german reading A1 A2 B1, german reading practice free, improve german reading skills, german text comprehension',
    canonical: 'https://app.langey.com/reading',
    ogTitle: 'German Reading Practice - Comprehension Exercises A1 A2 B1 | Langey',
    ogDescription: 'Practice German reading comprehension with interactive passages and exercises. Build reading fluency for A1, A2, and B1 levels with vocabulary support.',
    ogImage: 'https://app.langey.com/favicon.png',
    twitterImage: 'https://app.langey.com/favicon.png',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Langey German Reading Practice",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web",
      "description": "Interactive German reading comprehension practice with passages, fill-in-the-blank, true/false, and multiple choice exercises for A1, A2, and B1 levels. Vocabulary support and progress tracking included.",
      "url": "https://app.langey.com/reading",
      "inLanguage": "en",
      "teaches": "German Language",
      "educationalLevel": ["A1", "A2", "B1"],
      "offers": {
        "@type": "Offer",
        "price": "4.99",
        "priceCurrency": "USD",
        "priceSpecification": {
          "@type": "UnitPriceSpecification",
          "price": "4.99",
          "priceCurrency": "USD",
          "billingDuration": "P1M",
          "billingIncrement": "P1M"
        }
      },
      "featureList": [
        "German reading comprehension exercises",
        "Interactive reading passages",
        "Fill-in-the-blank reading practice",
        "True/false reading exercises",
        "Multiple choice reading comprehension",
        "German vocabulary support",
        "Reading practice for A1 A2 B1",
        "Progress tracking for reading",
        "Short stories and dialogues",
        "German text comprehension practice"
      ],
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "ratingCount": "3056"
      }
    }
  },
  '/listening': {
    title: 'German Listening Practice - Audio Comprehension Exercises A1 A2 B1 | Langey',
    description: 'Practice German listening comprehension with audio exercises. Improve German listening skills with fill-in-the-blank, true/false, and multiple choice exercises for A1, A2, B1 levels. Free German listening practice online with native speaker audio.',
    keywords: 'german listening practice, german listening comprehension, german listening exercises, practice german listening, german listening online, learn german listening, german audio exercises, german comprehension exercises, german listening A1 A2 B1, german listening practice free, improve german listening skills, german audio comprehension',
    canonical: 'https://app.langey.com/listening',
    ogTitle: 'German Listening Practice - Audio Comprehension Exercises A1 A2 B1 | Langey',
    ogDescription: 'Practice German listening comprehension with audio exercises and native speaker recordings. Build listening fluency for A1, A2, and B1 levels.',
    ogImage: 'https://app.langey.com/favicon.png',
    twitterImage: 'https://app.langey.com/favicon.png',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Langey German Listening Practice",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web",
      "description": "Interactive German listening comprehension practice with audio passages, fill-in-the-blank, true/false, and multiple choice exercises for A1, A2, and B1 levels. Native speaker audio and progress tracking included.",
      "url": "https://app.langey.com/listening",
      "inLanguage": "en",
      "teaches": "German Language",
      "educationalLevel": ["A1", "A2", "B1"],
      "offers": {
        "@type": "Offer",
        "price": "4.99",
        "priceCurrency": "USD",
        "priceSpecification": {
          "@type": "UnitPriceSpecification",
          "price": "4.99",
          "priceCurrency": "USD",
          "billingDuration": "P1M",
          "billingIncrement": "P1M"
        }
      },
      "featureList": [
        "German listening comprehension exercises",
        "Native speaker audio recordings",
        "Fill-in-the-blank listening practice",
        "True/false listening exercises",
        "Multiple choice listening comprehension",
        "German vocabulary support",
        "Listening practice for A1 A2 B1",
        "Progress tracking for listening",
        "Audio player with waveform visualization",
        "German audio comprehension practice"
      ],
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "ratingCount": "3056"
      }
    }
  },
  '/settings': {
    title: 'Account Settings - Langey German Learning Platform',
    description: 'Manage your Langey account settings. Update your profile, preferences, learning goals, and account information.',
    keywords: 'german learning settings, account settings, learning preferences, language learning goals, user profile',
    canonical: 'https://app.langey.com/settings',
    robots: 'noindex, nofollow',
    ogTitle: 'Account Settings - Langey',
    ogDescription: 'Manage your Langey learning account and preferences.',
    ogImage: 'https://app.langey.com/favicon.png',
    twitterImage: 'https://app.langey.com/favicon.png',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Langey Settings",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web",
      "description": "Account settings and preferences management for Langey German learning platform.",
      "url": "https://app.langey.com/settings"
    }
  },
  '/welcome': {
    title: 'Welcome to Langey - Start Learning German',
    description: 'Set up your German learning plan on Langey. Choose your level and timeline to get started.',
    keywords: 'langey welcome, start learning german, german onboarding',
    canonical: 'https://app.langey.com/welcome',
    robots: 'noindex, nofollow',
    ogTitle: 'Welcome to Langey',
    ogDescription: 'Set up your German learning plan and get started with Langey.',
    ogImage: 'https://app.langey.com/favicon.png',
    twitterImage: 'https://app.langey.com/favicon.png',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Welcome to Langey",
      "url": "https://app.langey.com/welcome"
    }
  },
  '/privacy-policy': {
    title: 'Privacy Policy | Langey',
    description: 'Read the Langey privacy policy for details about data collection, analytics, authentication, and AI-powered German learning features.',
    keywords: 'Langey privacy policy, German learning app privacy, Langey data protection',
    canonical: 'https://app.langey.com/privacy-policy',
    ogTitle: 'Privacy Policy | Langey',
    ogDescription: 'Read how Langey handles privacy, analytics, authentication, and learning data.',
    ogImage: 'https://app.langey.com/favicon.png',
    twitterImage: 'https://app.langey.com/favicon.png',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Langey Privacy Policy",
      "description": "Privacy policy for Langey German learning app.",
      "url": "https://app.langey.com/privacy-policy"
    }
  },
  '/terms-and-conditions': {
    title: 'Terms and Conditions | Langey',
    description: 'Read the Langey terms and conditions for using the German learning app, subscriptions, AI features, and account services.',
    keywords: 'Langey terms and conditions, Langey terms of service, German learning app terms',
    canonical: 'https://app.langey.com/terms-and-conditions',
    ogTitle: 'Terms and Conditions | Langey',
    ogDescription: 'Read the terms for using Langey German learning features, subscriptions, and account services.',
    ogImage: 'https://app.langey.com/favicon.png',
    twitterImage: 'https://app.langey.com/favicon.png',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Langey Terms and Conditions",
      "description": "Terms and conditions for Langey German learning app.",
      "url": "https://app.langey.com/terms-and-conditions"
    }
  }
};

export const DynamicSEO: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const config = SEO_CONFIGS[location.pathname] || SEO_CONFIGS['/'];

    applySeo(config);

  }, [location.pathname]);

  return null; // This component doesn't render anything
};
