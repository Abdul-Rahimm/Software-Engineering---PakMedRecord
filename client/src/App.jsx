import { BrowserRouter as Router } from 'react-router-dom';
import Routes from './Routes';
import { FeedbackProvider } from './ui/Feedback';
import { ThemeProvider } from './ui/Theme';

const App = () => (
  <ThemeProvider>
    <Router>
      <FeedbackProvider>
        <Routes />
      </FeedbackProvider>
    </Router>
  </ThemeProvider>
);

export default App;
