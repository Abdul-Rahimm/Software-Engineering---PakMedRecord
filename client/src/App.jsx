import { BrowserRouter as Router } from 'react-router-dom';
import Routes from './Routes';
import { FeedbackProvider } from './ui/Feedback';
import { ThemeProvider } from './ui/Theme';
import { I18nProvider } from './lib/i18n';
import OfflineBanner from './ui/OfflineBanner';

const App = () => (
  <I18nProvider>
    <ThemeProvider>
      <Router>
        <FeedbackProvider>
          <OfflineBanner />
          <Routes />
        </FeedbackProvider>
      </Router>
    </ThemeProvider>
  </I18nProvider>
);

export default App;
