import { Route, Routes } from 'react-router-dom';
import { DynamicSEO } from '../components/DynamicSEO';
import { LangeyLandingPage } from '../components/langeylandingpage';
import { PrivacyPolicy } from '../components/PrivacyPolicy';
import { TermsAndConditions } from '../components/TermsAndConditions';
import { WelcomePage } from './WelcomePage';

const learningPaths = [
  '/',
  '/vocabulary',
  '/grammar',
  '/speaking',
  '/writing',
  '/reading',
  '/listening',
  '/settings',
] as const;

export function AppRoutes() {
  return (
    <>
      <DynamicSEO />
      <Routes>
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        {learningPaths.map((path) => (
          <Route key={path} path={path} element={<LangeyLandingPage />} />
        ))}
      </Routes>
    </>
  );
}
