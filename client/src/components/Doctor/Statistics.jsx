import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { VictoryLine, VictoryPie } from 'victory';

const Statistics = () => {
  const [appointmentData, setAppointmentData] = useState([]);
  const { doctorCNIC } = useParams(); // Get doctorCNIC from URL params

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`http://localhost:3009/appointments/fetchByTime/${doctorCNIC}`);
        setAppointmentData(response.data);
      } catch (error) {
        console.error('Error fetching appointment data:', error);
      }
    };

    fetchData();
  }, [doctorCNIC]); // Include doctorCNIC in dependency array

  return (
    <div className="container">
      <div className="content">
        <div className="row justify-content-center">
          <div className="col-md-8">
            <div className="text-center mt-5">
              <h1 style={{ color: 'green' }}>PakMedRecord</h1>
            </div>
          </div>
        </div>

        <div className="row justify-content-center">
          <div className="col-md-6">
            <h2>Appointment Times by Day</h2>
            <VictoryLine
              data={appointmentData}
              x="day"
              y="time"
              style={{
                data: { stroke: "#c43a31" },
                parent: { border: "1px solid #ccc" }
              }}
            />
          </div>
          <div className="col-md-6">
            <h2>Appointment Times by Time Slot</h2>
            <VictoryPie
              data={appointmentData}
              x="timeSlot"
              y="count"
              colorScale={["tomato", "orange", "gold", "cyan", "navy"]}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
