const Vital = require('../models/VitalModel');
const { VITAL_TYPES } = require('../models/constants');

// Plausible ranges reject typos (e.g. 1200 bpm) without being clinical judgements
const RANGES = {
  bloodPressure: [[50, 260], [30, 180]],
  glucose: [[20, 800]],
  heartRate: [[20, 250]],
  weight: [[1, 400]],
  temperature: [[90, 110]],
  oxygen: [[50, 100]],
};

const inRange = (v, [lo, hi]) => Number.isFinite(v) && v >= lo && v <= hi;

const addVital = async (req, res) => {
  try {
    const { type, value, value2, recordedAt, note } = req.body;
    if (!VITAL_TYPES[type]) return res.status(400).json({ error: 'Unknown vital type' });

    const v1 = Number(value);
    if (!inRange(v1, RANGES[type][0])) return res.status(400).json({ error: `${VITAL_TYPES[type].label} value looks out of range` });
    let v2;
    if (VITAL_TYPES[type].paired) {
      v2 = Number(value2);
      if (!inRange(v2, RANGES[type][1])) return res.status(400).json({ error: 'Diastolic value looks out of range' });
    }
    const when = recordedAt ? new Date(recordedAt) : new Date();
    if (Number.isNaN(when.getTime()) || when > new Date(Date.now() + 5 * 60 * 1000)) {
      return res.status(400).json({ error: 'Enter a valid date and time' });
    }

    const vital = await Vital.create({
      patientCNIC: req.params.patientCNIC,
      type,
      value: v1,
      value2: v2,
      recordedAt: when,
      note: note ? String(note).trim().slice(0, 200) : undefined,
    });
    res.status(201).json({ message: 'Reading saved', vital });
  } catch (error) {
    console.error('Error saving vital:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getVitals = async (req, res) => {
  try {
    const filter = { patientCNIC: req.params.patientCNIC };
    if (req.query.type) filter.type = req.query.type;
    const vitals = await Vital.find(filter).sort({ recordedAt: -1 }).limit(500);
    res.status(200).json({ vitals, types: VITAL_TYPES });
  } catch (error) {
    console.error('Error fetching vitals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const removeVital = async (req, res) => {
  try {
    const deleted = await Vital.findOneAndDelete({ _id: req.params.id, patientCNIC: req.params.patientCNIC });
    if (!deleted) return res.status(404).json({ error: 'Reading not found' });
    res.status(200).json({ message: 'Reading deleted' });
  } catch (error) {
    console.error('Error deleting vital:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { addVital, getVitals, removeVital };
