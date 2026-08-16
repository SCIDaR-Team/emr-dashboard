/**
 * Rubric question → ODK column binding.
 *
 * The rubric names its 132 questions in prose; the workbook names its columns in
 * ODK codes. Nothing in either file joins the two, so this table does it by hand
 * — it is the join, and everything downstream (sub-theme scores, per-indicator
 * scores, 20 of the 24 minimum-requirement checks) rests on it.
 *
 * Three kinds of reference, resolved by resolveColumn() in eraDataset.mjs:
 *
 *   'C3.1'                 ODK question code, matched against the leading token
 *                          of a master-sheet header. 'D1' will not match 'D1.2'.
 *   'I1~Has this facility' code plus a disambiguator, for the handful of codes
 *                          the instrument reuses (two questions are numbered I1,
 *                          and the laboratory block numbers two columns M4.2).
 *   '=connection_to_grid'  exact header, for the derived columns that carry no
 *                          question code.
 *
 * A score reference of the form '#C2' means "the score copy of C2" — the master
 * sheet carries each scored question twice, the raw response first and its
 * 1/3/5 score second, and readSheet() suffixes the repeat '#2'.
 *
 * `question` is the first 60 characters of the rubric text, normalised. It is
 * checked against the CSV on every build: if the rubric is re-exported with rows
 * added, removed or reordered, the build fails here rather than silently binding
 * question 71 to question 70's column.
 *
 * Coverage: 69 of the 132 questions reach a score column. The rubric defines
 * response buckets for 94, but the published workbook only ever scored these —
 * see docs/SCORING.md, "What the rubric scores and the workbook does not".
 */

/** Rubric question number → its sub-thematic area (the ids in src/lib/themes.ts). */
export const SUB_THEME_RANGES = [[1,6,"technical_infrastructure.power"],[7,13,"technical_infrastructure.network"],[14,44,"technical_infrastructure.hardware"],[45,55,"workforce_capacity.competency"],[56,61,"workforce_capacity.roles"],[62,67,"workflow_transition.digitization"],[68,89,"workflow_transition.transition"],[90,103,"workflow_transition.service_points"],[104,107,"data_use_reporting.inefficiencies"],[108,118,"data_use_reporting.strengthening"],[119,122,"leadership_governance.policy"],[123,126,"leadership_governance.governance"],[127,132,"leadership_governance.resourcing"]];

export function subThemeForQuestion(n) {
  const hit = SUB_THEME_RANGES.find(([a, b]) => n >= a && n <= b);
  if (!hit) throw new Error(`No sub-theme for rubric question ${n}`);
  return hit[2];
}

/**
 * The five service points, in the order the per-service-point score columns are
 * listed below. `examination` is the canonical id; the instrument writes it as
 * 'triage' in some columns and 'examination' in others.
 */
export const SERVICE_POINT_IDS = ['registration', 'examination', 'consultation', 'laboratory', 'pharmacy'];

export const BINDINGS = [
  // Is this facility connected to the national electricity grid? (Yes/No)
  { n: 1, subThemeId: 'technical_infrastructure.power', question: "Is this facility connected to the national electricity grid?", responseColumns: ["C1"], scoreColumns: ["connection_to_grid"] },
  // On average, how many hours per day does the facility receive electricity from the national grid?
  { n: 2, subThemeId: 'technical_infrastructure.power', question: "On average, how many hours per day does the facility receive", responseColumns: ["C2"], scoreColumns: ["#C2"] },
  // Does the facility have any backup power source when electricity from the national grid is unavai
  { n: 3, subThemeId: 'technical_infrastructure.power', question: "Does the facility have any backup power source when electric", responseColumns: ["C3"], scoreColumns: ["#C3"] },
  // If yes, which backup power sources are available? (Generator, Solar/Inverter, UPS)
  { n: 4, subThemeId: 'technical_infrastructure.power', question: "If yes, which backup power sources are available? (Generator", responseColumns: ["C3.1"], scoreColumns: ["backup_power_source_score"] },
  // When fully operational, how long does each backup power source typically provide electricity?
  { n: 5, subThemeId: 'technical_infrastructure.power', question: "When fully operational, how long does each backup power sour", responseColumns: ["C3.2"], scoreColumns: ["#C3.2"] },
  // Does the facility have functional electrical wiring to support ICT and other digital equipment? 
  { n: 6, subThemeId: 'technical_infrastructure.power', question: "Does the facility have functional electrical wiring to suppo", responseColumns: ["C4"], scoreColumns: ["#C4"] },
  // How does the facility primarily access the internet? (Router, USB modem, Satellite, No internet,
  { n: 7, subThemeId: 'technical_infrastructure.network', question: "How does the facility primarily access the internet? (Router", responseColumns: ["E1"], scoreColumns: ["#E1"] },
  // Which internet service provider provides the most reliable internet connection for routine facil
  { n: 8, subThemeId: 'technical_infrastructure.network', question: "Which internet service provider provides the most reliable i", responseColumns: ["E2.2"] },
  // How fast is the internet connection when it is working? (Low – less than 10 Mbps / Average/Moder
  { n: 9, subThemeId: 'technical_infrastructure.network', question: "How fast is the internet connection when it is working? (Low", responseColumns: ["E3","=Internet speed (download)"], scoreColumns: ["=Internet speed (download)#2"] },
  // How reliable is the internet connection for daily work? (Very reliable – rarely experiences down
  { n: 10, subThemeId: 'technical_infrastructure.network', question: "How reliable is the internet connection for daily work? (Ver", responseColumns: ["E5"], scoreColumns: ["#E5"] },
  // Upload a screenshot of the internet speed measurement page
  { n: 11, subThemeId: 'technical_infrastructure.network', question: "Upload a screenshot of the internet speed measurement page", responseColumns: ["E4"] },
  // Is there another internet option available when the main one is not working? (Yes / No)
  { n: 12, subThemeId: 'technical_infrastructure.network', question: "Is there another internet option available when the main one", responseColumns: ["E6"], scoreColumns: ["backup_internet_available"] },
  // Which backup internet option do you use in the facility? (Router Mobile hotspot (phone data), US
  { n: 13, subThemeId: 'technical_infrastructure.network', question: "Which backup internet option do you use in the facility? (Ro", responseColumns: ["E6.1"], scoreColumns: ["backup_option_score"] },
  // Which of the following digital devices are available in the facility? (Select all that apply)
  { n: 14, subThemeId: 'technical_infrastructure.hardware', question: "Which of the following digital devices are available in the ", responseColumns: ["D1"], scoreColumns: ["#D1"] },
  // How many computing devices are available in the facility?
  { n: 15, subThemeId: 'technical_infrastructure.hardware', question: "How many computing devices are available in the facility?", responseColumns: ["=computing_devices_available","=minimum_required_devices","=number_service_points"], scoreColumns: ["computing_device_score"] },
  // How many desktop computers are available in the facility?
  { n: 16, subThemeId: 'technical_infrastructure.hardware', question: "How many desktop computers are available in the facility?", responseColumns: ["D1.2"] },
  // What is the general condition of the desktop computers? (Fully functional / Needs repairs / Obso
  { n: 17, subThemeId: 'technical_infrastructure.hardware', question: "What is the general condition of the desktop computers? (Ful", responseColumns: ["D1.3"] },
  // What is the specification (processor, RAM, storage, and OS) of the desktops?
  { n: 18, subThemeId: 'technical_infrastructure.hardware', question: "What is the specification (processor, RAM, storage, and OS) ", responseColumns: ["D1.4"] },
  // How many laptop computers are available?
  { n: 19, subThemeId: 'technical_infrastructure.hardware', question: "How many laptop computers are available?", responseColumns: ["D1.5"] },
  // What is the general condition of the laptop computers?
  { n: 20, subThemeId: 'technical_infrastructure.hardware', question: "What is the general condition of the laptop computers?", responseColumns: ["D1.6"] },
  // What is the specification (processor, RAM, storage, and OS) of the laptops?
  { n: 21, subThemeId: 'technical_infrastructure.hardware', question: "What is the specification (processor, RAM, storage, and OS) ", responseColumns: ["D1.7"] },
  // How many tablets are available?
  { n: 22, subThemeId: 'technical_infrastructure.hardware', question: "How many tablets are available?", responseColumns: ["D1.8"] },
  // What is the general condition of the tablets?
  { n: 23, subThemeId: 'technical_infrastructure.hardware', question: "What is the general condition of the tablets?", responseColumns: ["D1.9"] },
  // What is the specification (processor, RAM, storage, and OS) of the tablets?
  { n: 24, subThemeId: 'technical_infrastructure.hardware', question: "What is the specification (processor, RAM, storage, and OS) ", responseColumns: ["D1.10"] },
  // How many printers/scanners are available?
  { n: 25, subThemeId: 'technical_infrastructure.hardware', question: "How many printers/scanners are available?", responseColumns: ["D1.13"] },
  // What is the general condition of the printers/scanners?
  { n: 26, subThemeId: 'technical_infrastructure.hardware', question: "What is the general condition of the printers/scanners?", responseColumns: ["D1.14"] },
  // Does the facility have a routine maintenance schedule for digital devices?
  { n: 27, subThemeId: 'technical_infrastructure.hardware', question: "Does the facility have a routine maintenance schedule for di", responseColumns: ["D2"], scoreColumns: ["digital_device_maintenance_schedule"] },
  // Has this facility used any digital health system before?
  { n: 28, subThemeId: 'technical_infrastructure.hardware', question: "Has this facility used any digital health system before?", responseColumns: ["D3"], scoreColumns: ["prior_use_digital_systems"] },
  // What type of digital health system does the facility use? (Select all that apply)
  { n: 29, subThemeId: 'technical_infrastructure.hardware', question: "What type of digital health system does the facility use? (S", responseColumns: ["D3.1"], scoreColumns: ["digital_system_type_score"] },
  // What is the name of the Electronic Medical Record (EMR) system used?
  { n: 30, subThemeId: 'technical_infrastructure.hardware', question: "What is the name of the Electronic Medical Record (EMR) syst", responseColumns: ["D3.2"] },
  // What is the current status of the electronic medical record being used at the health facility?
  { n: 31, subThemeId: 'technical_infrastructure.hardware', question: "What is the current status of the electronic medical record ", responseColumns: ["D3.2.1"], scoreColumns: ["emr_status"] },
  // Which services in this facility are currently captured in the EMR system?
  { n: 32, subThemeId: 'technical_infrastructure.hardware', question: "Which services in this facility are currently captured in th", responseColumns: ["D3.2.3"] },
  // What type of EMR deployment architecture is used in this facility?
  { n: 33, subThemeId: 'technical_infrastructure.hardware', question: "What type of EMR deployment architecture is used in this fac", responseColumns: ["D3.2.4"] },
  // How reliable is the EMR system during routine use?
  { n: 34, subThemeId: 'technical_infrastructure.hardware', question: "How reliable is the EMR system during routine use?", responseColumns: ["D3.2.5"] },
  // What is the name of the service delivery systems used?
  { n: 35, subThemeId: 'technical_infrastructure.hardware', question: "What is the name of the service delivery systems used?", responseColumns: ["D3.3"] },
  // What is the current status of the service delivery systems (laboratory information system, pharm
  { n: 36, subThemeId: 'technical_infrastructure.hardware', question: "What is the current status of the service delivery systems (", responseColumns: ["D3.3.1"] },
  // What is the name of the Logistics Management Information System (LMIS) used?
  { n: 37, subThemeId: 'technical_infrastructure.hardware', question: "What is the name of the Logistics Management Information Sys", responseColumns: ["D3.4"] },
  // What is the current status of the logistics management information system being used at the heal
  { n: 38, subThemeId: 'technical_infrastructure.hardware', question: "What is the current status of the logistics management infor", responseColumns: ["D3.4.1"] },
  // What is the name of the financial management software used?
  { n: 39, subThemeId: 'technical_infrastructure.hardware', question: "What is the name of the financial management software used?", responseColumns: ["D3.5"] },
  // What is the current status of the financial management software being used at the health facilit
  { n: 40, subThemeId: 'technical_infrastructure.hardware', question: "What is the current status of the financial management softw", responseColumns: ["D3.5.1"] },
  // What system does the facility have for backing up data?
  { n: 41, subThemeId: 'technical_infrastructure.hardware', question: "What system does the facility have for backing up data?", responseColumns: ["L5"] },
  // How often is data backed up?
  { n: 42, subThemeId: 'technical_infrastructure.hardware', question: "How often is data backed up?", responseColumns: ["L5.1"] },
  // Does the facility have documented procedures or SOPs for managing digital system operations (e.g
  { n: 43, subThemeId: 'technical_infrastructure.hardware', question: "Does the facility have documented procedures or SOPs for man", responseColumns: ["L6"], scoreColumns: ["documented_sop_score"] },
  // What security measures are in place to protect stored data? (Internal and external security meas
  { n: 44, subThemeId: 'technical_infrastructure.hardware', question: "What security measures are in place to protect stored data? ", responseColumns: ["L7"] },
  // Do facility staff use digital devices for basic digital tasks? (Yes/No)
  { n: 45, subThemeId: 'workforce_capacity.competency', question: "Do facility staff use digital devices for basic digital task", responseColumns: ["F1"], scoreColumns: ["#F1"] },
  // Which of the following devices do staff commonly use? Computing devices: - Desktop - Laptops - T
  { n: 46, subThemeId: 'workforce_capacity.competency', question: "Which of the following devices do staff commonly use? Comput", responseColumns: ["F2"] },
  // Do staff regularly use digital devices to carry out tasks such as typing documents, sending emai
  { n: 47, subThemeId: 'workforce_capacity.competency', question: "Do staff regularly use digital devices to carry out tasks su", responseColumns: ["F3"] },
  // Have staff in this facility received any formal training on digital health tools? (Yes/No)
  { n: 48, subThemeId: 'workforce_capacity.competency', question: "Have staff in this facility received any formal training on ", responseColumns: ["F4"], scoreColumns: ["#F4"] },
  // When was the most recent digital health or digital skills training conducted? - Within the last 
  { n: 49, subThemeId: 'workforce_capacity.competency', question: "When was the most recent digital health or digital skills tr", responseColumns: ["F4.1"], scoreColumns: ["#F4.1"] },
  // How often are these trainings conducted? - One-time - Annually - Biannually - As needed - Quarte
  { n: 50, subThemeId: 'workforce_capacity.competency', question: "How often are these trainings conducted? - One-time - Annual", responseColumns: ["F4.2"] },
  // What was the most recent training about? - EMR/EHR systems - Health information systems (e.g., D
  { n: 51, subThemeId: 'workforce_capacity.competency', question: "What was the most recent training about? - EMR/EHR systems -", responseColumns: ["F4.3"], scoreColumns: ["#F4.3"] },
  // How was the training conducted? - In-person training - Virtual/online - Blended (physical + onli
  { n: 52, subThemeId: 'workforce_capacity.competency', question: "How was the training conducted? - In-person training - Virtu", responseColumns: ["F4.4"] },
  // How effective has the training been in improving staff ability to use digital systems? - Very ef
  { n: 53, subThemeId: 'workforce_capacity.competency', question: "How effective has the training been in improving staff abili", responseColumns: ["F4.6"] },
  // Which digital skills do staff need to improve the most? - Basic device operation (e.g., turning 
  { n: 54, subThemeId: 'workforce_capacity.competency', question: "Which digital skills do staff need to improve the most? - Ba", responseColumns: ["F5"] },
  // What are the main challenges preventing staff from improving their digital skills? - Time and wo
  { n: 55, subThemeId: 'workforce_capacity.competency', question: "What are the main challenges preventing staff from improving", responseColumns: ["F6"] },
  // What is the total number of technical staff (clinical and administrative) in the facility?
  { n: 56, subThemeId: 'workforce_capacity.roles', question: "What is the total number of technical staff (clinical and ad", responseColumns: ["G1"] },
  // Of the total technical staff, how many are full-time (pensionable staff)?
  { n: 57, subThemeId: 'workforce_capacity.roles', question: "Of the total technical staff, how many are full-time (pensio", responseColumns: ["G2"] },
  // Of the total technical staff, how many are contract staff and/or volunteers?
  { n: 58, subThemeId: 'workforce_capacity.roles', question: "Of the total technical staff, how many are contract staff an", responseColumns: [] },
  // How many male technical staff (clinical and administrative) are in the facility?
  { n: 59, subThemeId: 'workforce_capacity.roles', question: "How many male technical staff (clinical and administrative) ", responseColumns: ["G3"] },
  // How many female technical staff (clinical and administrative) are in the facility?
  { n: 60, subThemeId: 'workforce_capacity.roles', question: "How many female technical staff (clinical and administrative", responseColumns: ["G4"] },
  // Does the facility have a dedicated Health Records/Monitoring and Evaluation (M&E) Officer?
  { n: 61, subThemeId: 'workforce_capacity.roles', question: "Does the facility have a dedicated Health Records/Monitoring", responseColumns: ["G6"], scoreColumns: ["#G6"] },
  // Which of the following service points currently exist and routinely document patient/service inf
  { n: 62, subThemeId: 'workflow_transition.digitization', question: "Which of the following service points currently exist and ro", responseColumns: ["H1"], scoreColumns: ["service_points_score"] },
  // Which service points currently use digital systems to record or manage patient information? (Pat
  { n: 63, subThemeId: 'workflow_transition.digitization', question: "Which service points currently use digital systems to record", responseColumns: ["H2"], scoreColumns: ["=use of digital tools at service points"] },
  // Is patient information recorded more than once for the same visit across different service point
  { n: 64, subThemeId: 'workflow_transition.digitization', question: "Is patient information recorded more than once for the same ", responseColumns: ["H3"], scoreColumns: ["=duplicate patient information"] },
  // At which service points is the same patient information recorded more than once (e.g., entered r
  { n: 65, subThemeId: 'workflow_transition.digitization', question: "At which service points is the same patient information reco", responseColumns: ["H4"], scoreColumns: ["patient_info_duplicates_service_points"] },
  // At which service points is the same patient information recorded in both paper and digital syste
  { n: 66, subThemeId: 'workflow_transition.digitization', question: "At which service points is the same patient information reco", responseColumns: ["H5"], scoreColumns: ["patient_info_duplicates_service_points_hybrid"] },
  // At which service points do delays or workflow bottlenecks most commonly occur? (Patient registra
  { n: 67, subThemeId: 'workflow_transition.digitization', question: "At which service points do delays or workflow bottlenecks mo", responseColumns: ["H6"] },
  // Has this facility ever moved from paper records to digital systems? (Yes/No)
  { n: 68, subThemeId: 'workflow_transition.transition', question: "Has this facility ever moved from paper records to digital s", responseColumns: ["I1~Has this facility previously transitioned"], scoreColumns: ["paper_digital_transition"] },
  // What is the current status of EMR implementation in this facility?
  { n: 69, subThemeId: 'workflow_transition.transition', question: "What is the current status of EMR implementation in this fac", responseColumns: ["I1~What is the current status"], scoreColumns: ["emr_transition_status"] },
  // How long were paper-based records and the EMR system used concurrently during implementation? (L
  { n: 70, subThemeId: 'workflow_transition.transition', question: "How long were paper-based records and the EMR system used co", responseColumns: ["I1.2"], scoreColumns: ["=paper and digital systems simulataneous use"] },
  // Before digital tools were introduced, were any of the following done? (Select all that apply) (S
  { n: 71, subThemeId: 'workflow_transition.transition', question: "Before digital tools were introduced, were any of the follow", responseColumns: ["I1.3"], scoreColumns: ["pre_implementation_steps"] },
  // How did introducing digital tools affect staff workload? (Greatly reduced / Slightly reduced / N
  { n: 72, subThemeId: 'workflow_transition.transition', question: "How did introducing digital tools affect staff workload? (Gr", responseColumns: ["I1.4"], scoreColumns: ["=digital tools affect staff workload"] },
  // How effective are the digital tools in supporting operational workflows? (Very effective / Effec
  { n: 73, subThemeId: 'workflow_transition.transition', question: "How effective are the digital tools in supporting operationa", responseColumns: ["I1.5"], scoreColumns: ["=digital tools effectiveness in supporting operational workflows"] },
  // How has EMR implementation improved routine service delivery workflows in this facility? (Reduce
  { n: 74, subThemeId: 'workflow_transition.transition', question: "How has EMR implementation improved routine service delivery", responseColumns: ["I1.6"], scoreColumns: ["service_delivery_workflows_improvements"] },
  // What workflow or operational challenges exist with the EMR system? (System performance and avail
  { n: 75, subThemeId: 'workflow_transition.transition', question: "What workflow or operational challenges exist with the EMR s", responseColumns: ["I1.7"], scoreColumns: ["service_delivery_workflows_challenges"] },
  // How willing are staff to fully switch to digital systems? (Very willing / Willing / Neutral / Un
  { n: 76, subThemeId: 'workflow_transition.transition', question: "How willing are staff to fully switch to digital systems? (V", responseColumns: ["I3"] },
  // What type of support would staff require during EMR rollout and implementation? (Onsite technica
  { n: 77, subThemeId: 'workflow_transition.transition', question: "What type of support would staff require during EMR rollout ", responseColumns: ["I4"] },
  // Which service points would benefit most from digitization? (Patient registration / Examination /
  { n: 78, subThemeId: 'workflow_transition.transition', question: "Which service points would benefit most from digitization? (", responseColumns: ["I5"] },
  // Based on your experience with patients, how do you think they would respond to the use of digita
  { n: 79, subThemeId: 'workflow_transition.transition', question: "Based on your experience with patients, how do you think the", responseColumns: ["J1"] },
  // What challenges do you think patients might face with the use of digital systems? (Privacy and c
  { n: 80, subThemeId: 'workflow_transition.transition', question: "What challenges do you think patients might face with the us", responseColumns: ["J2"] },
  // How do you think using digital systems would affect patient experience in this facility? (Improv
  { n: 81, subThemeId: 'workflow_transition.transition', question: "How do you think using digital systems would affect patient ", responseColumns: ["J3"] },
  // Does this facility refer patients to other health facilities? (Yes/ No)
  { n: 82, subThemeId: 'workflow_transition.transition', question: "Does this facility refer patients to other health facilities", responseColumns: ["K1"] },
  // If yes, where are patients most commonly referred to? (Another PHC facility/ Secondary facility 
  { n: 83, subThemeId: 'workflow_transition.transition', question: "If yes, where are patients most commonly referred to? (Anoth", responseColumns: ["K2"] },
  // If patients are referred to another PHC facility, what level are they typically referred to? (Le
  { n: 84, subThemeId: 'workflow_transition.transition', question: "If patients are referred to another PHC facility, what level", responseColumns: ["K2.1"] },
  // If not sure, what is the name of the facility where patients are usually referred?
  { n: 85, subThemeId: 'workflow_transition.transition', question: "If not sure, what is the name of the facility where patients", responseColumns: ["K2.2"] },
  // If no, why does this facility not refer patients? (Most cases can be managed at this facility/ L
  { n: 86, subThemeId: 'workflow_transition.transition', question: "If no, why does this facility not refer patients? (Most case", responseColumns: ["K3"] },
  // How are referrals typically made from this facility? (Paper referral form/letter/ Verbal instruc
  { n: 87, subThemeId: 'workflow_transition.transition', question: "How are referrals typically made from this facility? (Paper ", responseColumns: ["K4"] },
  // Does this facility have a system for following up on referred cases? (Yes/ No)
  { n: 88, subThemeId: 'workflow_transition.transition', question: "Does this facility have a system for following up on referre", responseColumns: ["K5"] },
  // What challenges does the facility face in managing patient referrals? (Lack of standard referral
  { n: 89, subThemeId: 'workflow_transition.transition', question: "What challenges does the facility face in managing patient r", responseColumns: ["K6"] },
  // Is there a functional device available for documentation?
  { n: 90, subThemeId: 'workflow_transition.service_points', question: "Is there a functional device available for documentation?", responseColumns: ["M1.2","M2.2","M3.2","M4.2~Is there a functional device","M5.2"], scoreColumns: ["functional_device_registration","functional_device_triage","functional_device_consultation","functional_device_lab","functional_device_pharm"], duplicateScoreColumns: ["device_registration","device_triage","device_consultation","device_lab","device_pharm"] },
  // What type of device? (Desktop/ Laptop/ Tablet/ Smartphone/ Other)
  { n: 91, subThemeId: 'workflow_transition.service_points', question: "What type of device? (Desktop/ Laptop/ Tablet/ Smartphone/ O", responseColumns: ["M1.2.1","M2.2.1","M3.2.1","M4.2~If yes, what type","M5.2.1"] },
  // What digital system(s) are used?
  { n: 92, subThemeId: 'workflow_transition.service_points', question: "What digital system(s) are used?", responseColumns: ["M1.3","M2.3","M3.3","M4.3","M5.3"] },
  // For this service point, which of the following items or conditions are present? (Desk/counter th
  { n: 93, subThemeId: 'workflow_transition.service_points', question: "For this service point, which of the following items or cond", responseColumns: ["M1.4","M2.4","M3.4","M4.4","M5.4"], scoreColumns: ["registration_infra_score","triage_infra_score","consultation_infra_score","lab_infra_score","pharmacy_infra_score"] },
  // Are there plans in place to address any of the identified issues mentioned? (Yes, fully planned 
  { n: 94, subThemeId: 'workflow_transition.service_points', question: "Are there plans in place to address any of the identified is", responseColumns: ["M1.5","M2.5","M3.5","M4.5","M5.5"], scoreColumns: ["registration_infra_action_plan_score","triage_infra_action_plan_score","consultation_infra_action_plan_score","lab_infra_action_plan_score","pharm_infra_action_plan_score"] },
  // Who is primarily responsible for documentation at this service point
  { n: 95, subThemeId: 'workflow_transition.service_points', question: "Who is primarily responsible for documentation at this servi", responseColumns: ["M1.6","M2.6","M3.6","M4.6","M5.6"] },
  // Who is primarily responsible for documentation at this service point? (Doctor, Nurse/Midwife, CH
  { n: 96, subThemeId: 'workflow_transition.service_points', question: "Who is primarily responsible for documentation at this servi", responseColumns: ["M1.6","M2.6","M3.6","M4.6","M5.6"] },
  // Is this staff member also responsible for documentation in another service point?
  { n: 97, subThemeId: 'workflow_transition.service_points', question: "Is this staff member also responsible for documentation in a", responseColumns: ["M1.6.1","M2.6.1","M3.6.1","M4.6.1","M5.6.1"], scoreColumns: ["other_point_staff_registration","other_point_staff_triage","other_point_staff_consultation","other_point_staff_lab","other_point_staff_pharm"] },
  // Which other service points does this staff member support?
  { n: 98, subThemeId: 'workflow_transition.service_points', question: "Which other service points does this staff member support?", responseColumns: ["M1.6.2","M2.6.2","M3.6.2","M4.6.2","M5.6.2"] },
  // How many staff are routinely assigned to this service point?
  { n: 99, subThemeId: 'workflow_transition.service_points', question: "How many staff are routinely assigned to this service point?", responseColumns: ["M1.7","M2.7","M3.7","M4.7","M5.7"] },
  // Of the staff assigned to this service point, how many are permanent staff?
  { n: 100, subThemeId: 'workflow_transition.service_points', question: "Of the staff assigned to this service point, how many are pe", responseColumns: ["M1.7.1","M2.7.1","M3.7.1","M4.7.1","M5.7.1"] },
  // Of the staff assigned to this service point, how many are full-time at this service point?
  { n: 101, subThemeId: 'workflow_transition.service_points', question: "Of the staff assigned to this service point, how many are fu", responseColumns: ["M1.7.2","M2.7.2","M3.7.2","M4.7.2","M5.7.2"] },
  // Of the staff assigned to this service point, how many are part-time/shared with another service 
  { n: 102, subThemeId: 'workflow_transition.service_points', question: "Of the staff assigned to this service point, how many are pa", responseColumns: [] },
  // Can staff at this service point perform basic digital tasks without assistance?
  { n: 103, subThemeId: 'workflow_transition.service_points', question: "Can staff at this service point perform basic digital tasks ", responseColumns: ["M1.8","M2.8","M3.8","M4.8","M5.8"], scoreColumns: ["digital_skills_registration","digital_skills_triage","digital_skills_consultation","digital_skills_lab","digital_skills_pharm"] },
  // How is routine service delivery data primairly collected and recorded in this facility? (Paper o
  { n: 104, subThemeId: 'data_use_reporting.inefficiencies', question: "How is routine service delivery data primairly collected and", responseColumns: ["L1"], scoreColumns: ["service_delivery_method"] },
  // What challenges do you face when using paper registers for data entry? (Time-consuming data entr
  { n: 105, subThemeId: 'data_use_reporting.inefficiencies', question: "What challenges do you face when using paper registers for d", responseColumns: ["L2"] },
  // Is there a defined plan to transition from paper to digital systems? - Yes, with clear timeline 
  { n: 106, subThemeId: 'data_use_reporting.inefficiencies', question: "Is there a defined plan to transition from paper to digital ", responseColumns: ["L3"], scoreColumns: ["clear_timeline"] },
  // What challenges do you face when using digital systems for data entry? (Duplicate entries, Syste
  { n: 107, subThemeId: 'data_use_reporting.inefficiencies', question: "What challenges do you face when using digital systems for d", responseColumns: ["L8"] },
  // Does the facility use digital dashboards to review routine service delivery data? Yes No Not sur
  { n: 108, subThemeId: 'data_use_reporting.strengthening', question: "Does the facility use digital dashboards to review routine s", responseColumns: ["L10"], scoreColumns: ["digital_dashboard_use"] },
  // What type of digital dashboards are available? Real-time dashboards linked to digital systems/EM
  { n: 109, subThemeId: 'data_use_reporting.strengthening', question: "What type of digital dashboards are available? Real-time das", responseColumns: ["L10.1"] },
  // If yes, how often are the data validation meetings held? (Weekly / Monthly / Quarterly / Occasio
  { n: 110, subThemeId: 'data_use_reporting.strengthening', question: "If yes, how often are the data validation meetings held? (We", responseColumns: ["L12"], scoreColumns: ["validation_meeting_schedule"] },
  // During these meetings, how often are PHC service reports discussed? (Always, Often, Sometimes, R
  { n: 111, subThemeId: 'data_use_reporting.strengthening', question: "During these meetings, how often are PHC service reports dis", responseColumns: ["L12.1"], scoreColumns: ["frequency_report_discussion"] },
  // Which routine service delivery indicators are most frequently reviewed in this facility? Patient
  { n: 112, subThemeId: 'data_use_reporting.strengthening', question: "Which routine service delivery indicators are most frequentl", responseColumns: ["L11"] },
  // What data quality checks are built into the EMR system? (Select all that apply) Mandatory fields
  { n: 113, subThemeId: 'data_use_reporting.strengthening', question: "What data quality checks are built into the EMR system? (Sel", responseColumns: ["L13"] },
  // Are any routine service reports generated using EMRs in this facility? Yes No
  { n: 114, subThemeId: 'data_use_reporting.strengthening', question: "Are any routine service reports generated using EMRs in this", responseColumns: ["L14"], scoreColumns: ["routine_report_generation"] },
  // Are routine service reports generated automatically from the EMR? Yes, fully automated Partially
  { n: 115, subThemeId: 'data_use_reporting.strengthening', question: "Are routine service reports generated automatically from the", responseColumns: ["L14.1"], scoreColumns: ["routine_report_generation_automated"] },
  // Does the EMR system currently support integration with DHIS2? Yes No
  { n: 116, subThemeId: 'data_use_reporting.strengthening', question: "Does the EMR system currently support integration with DHIS2", responseColumns: ["L17.1"], scoreColumns: ["emr_integration_DHIS2"] },
  // What analytics are available in the EMR? (Select all) Trend analysis Indicator summaries Perform
  { n: 117, subThemeId: 'data_use_reporting.strengthening', question: "What analytics are available in the EMR? (Select all) Trend ", responseColumns: ["L15"] },
  // Has EMR data led to any service improvements in this facility? Yes No Not sure
  { n: 118, subThemeId: 'data_use_reporting.strengthening', question: "Has EMR data led to any service improvements in this facilit", responseColumns: ["L16"] },
  // Does the state have an official Digital Health or ICT-in-Health Policy?
  { n: 119, subThemeId: 'leadership_governance.policy', question: "Does the state have an official Digital Health or ICT-in-Hea", responseColumns: [] },
  // Has the state formally adopted or aligned with the National Digital Health Strategy (2023–2030)?
  { n: 120, subThemeId: 'leadership_governance.policy', question: "Has the state formally adopted or aligned with the National ", responseColumns: [] },
  // Is digital health mentioned in the State Health Sector Strategic Plan?
  { n: 121, subThemeId: 'leadership_governance.policy', question: "Is digital health mentioned in the State Health Sector Strat", responseColumns: [] },
  // Does the state have documented interoperability standards aligned with national platforms?
  { n: 122, subThemeId: 'leadership_governance.policy', question: "Does the state have documented interoperability standards al", responseColumns: [] },
  // Is there a designated Digital Health or ICT team?
  { n: 123, subThemeId: 'leadership_governance.governance', question: "Is there a designated Digital Health or ICT team?", responseColumns: [] },
  // Is there a steering committee that oversees digital health implementation?
  { n: 124, subThemeId: 'leadership_governance.governance', question: "Is there a steering committee that oversees digital health i", responseColumns: [] },
  // Are there written policy documents or governance frameworks for managing digital systems and dat
  { n: 125, subThemeId: 'leadership_governance.governance', question: "Are there written policy documents or governance frameworks ", responseColumns: [] },
  // Has the state leadership publicly declared its digital health goals or plans?
  { n: 126, subThemeId: 'leadership_governance.governance', question: "Has the state leadership publicly declared its digital healt", responseColumns: [] },
  // Has the state allocated a specific budget line for digital health?
  { n: 127, subThemeId: 'leadership_governance.resourcing', question: "Has the state allocated a specific budget line for digital h", responseColumns: [] },
  // Has the state invested in ICT/digital health systems in the past 3 years?
  { n: 128, subThemeId: 'leadership_governance.resourcing', question: "Has the state invested in ICT/digital health systems in the ", responseColumns: [] },
  // Is there a plan to maintain digital systems (e.g., hardware, software, connectivity)?
  { n: 129, subThemeId: 'leadership_governance.resourcing', question: "Is there a plan to maintain digital systems (e.g., hardware,", responseColumns: [] },
  // Are there partnerships (e.g., with development partners) supporting digital health initiatives?
  { n: 130, subThemeId: 'leadership_governance.resourcing', question: "Are there partnerships (e.g., with development partners) sup", responseColumns: [] },
  // Is digitisation (including system maintenance and running costs) included as a line item in heal
  { n: 131, subThemeId: 'leadership_governance.resourcing', question: "Is digitisation (including system maintenance and running co", responseColumns: [] },
  // How are the ongoing costs of digital systems (e.g., maintenance, upgrades) expected to be financ
  { n: 132, subThemeId: 'leadership_governance.resourcing', question: "How are the ongoing costs of digital systems (e.g., maintena", responseColumns: [] },
];

/**
 * One scored column has no rubric question behind it: `use_of_data` sits in the
 * Data Use core block and enters the published core mean, but the rubric never
 * lists "how is routine data used for decision-making" as a question. It is
 * carried as a 133rd indicator rather than dropped — dropping it would break the
 * reproduction of the published theme score.
 */
export const UNRUBRICED = [
  {
    n: 133,
    subThemeId: 'data_use_reporting.strengthening',
    question: 'How is routine service delivery data typically used for decision-making in this facility?',
    responseColumns: ['L9'],
    scoreColumns: ['use_of_data'],
    rubricUnmatched: true,
  },
];
