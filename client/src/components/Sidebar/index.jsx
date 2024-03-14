import React from 'react'
import { Container, Content } from './styles'
import { Link, useNavigate } from 'react-router-dom';
import { 
  FaTimes, 
  FaHome, 
  FaRegSun, 
  FaSignOutAlt
} from 'react-icons/fa'

import SidebarItem from '../SidebarItem'

const Sidebar = ({ active }) => {
  const navigate = useNavigate(); // Import useNavigate from react-router-dom

  const closeSidebar = () => {
    active(false)
  }

  const handleLogout = () => {
    const confirmLogout = window.confirm('Are you sure you want to log out?');
    
    if (confirmLogout) {
      navigate('/'); // Navigate to the homepage (heropage)
    }
  };

  return (
    <Container sidebar={active ? 1 : 0}> {/* Ensure sidebar prop is either 1 or 0 */}
      <FaTimes onClick={closeSidebar} />  
      <Content>
        <SidebarItem Icon={FaHome} Text="Home" />
        <SidebarItem Icon={FaRegSun} Text="Settings" />
        <SidebarItem Icon={FaSignOutAlt} Text="Logout" onClick={handleLogout}  /> {/* Logout button */}
      </Content>
    </Container>
  )
}

export default Sidebar
