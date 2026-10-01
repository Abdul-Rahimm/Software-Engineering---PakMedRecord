import { BrowserRouter as Router } from 'react-router-dom';
import Routes from './Routes';
import { FeedbackProvider } from './ui/Feedback';

const App = () => (
  <Router>
    <FeedbackProvider>
      <Routes />
    </FeedbackProvider>
  </Router>
);

export default App;
