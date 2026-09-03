import type { AnatomyDetail } from "@/lib/anatomy/types";

/**
 * Detailed anatomy content registry
 * Keyed by structure ID
 */
export const anatomyDetailsData: Record<string, AnatomyDetail> = {
  "bone.femur": {
    description: "The longest, heaviest, and strongest bone in the human body, forming the skeletal framework of the thigh.",
    function: "Supports body weight during standing and walking, acting as a primary lever for lower limb locomotion.",
    location: "Thigh region of the lower limb, articulating proximally with the acetabulum of the hip bone and distally with the tibia and patella.",
    clinical: "Important in assessing femoral neck fractures, hip dislocations, and knee alignment.",
  },
  "bone.tibia": {
    description: "A major weight-bearing long bone of the lower leg, forming the skeletal framework between the knee and ankle.",
    function: "Supports body weight during standing and locomotion and participates in the biomechanics of the knee and ankle joints.",
    location: "Medial aspect of the leg, articulating proximally with the femur and distally with the talus of the ankle.",
    clinical: "Important in evaluating tibial fractures, compartment syndrome, and alignment of the knee and ankle joints.",
  },
  "muscle.sartorius": {
    description: "A long, slender, strap-like muscle that obliquely crosses the anterior compartment of the thigh.",
    function: "Flexes, abducts, and laterally rotates the hip joint, and assists in knee joint flexion.",
    location: "Originates near the anterior superior iliac spine, crosses the thigh diagonally, and inserts on the anteromedial surface of the proximal tibia.",
    clinical: "Serves as an anatomical landmark for the femoral triangle and forms part of the pes anserinus insertion at the knee.",
  },
  "nerve.optic": {
    description: "The second cranial nerve (CN II) dedicated to transmitting visual sensory information from the retina to the brain.",
    function: "Transmits visual impulses from retinal photoreceptors to the central nervous system to facilitate visual perception.",
    location: "Originates at the posterior aspect of the eyeball, traverses the orbit and optic canal, and enters the cranial cavity toward the optic chiasm.",
    clinical: "Crucial in evaluating optic nerve trauma, compression from intracranial lesions, and visual pathway disorders.",
  },
  "vessel.femoral.artery": {
    description: "The primary arterial conduit supplying oxygenated blood to the lower extremity, continuing from the external iliac artery.",
    function: "Delivers oxygenated blood and nutrients to the tissues of the thigh, leg, and foot.",
    location: "Enters the thigh beneath the inguinal ligament, courses through the femoral triangle, and descends along the anteromedial thigh.",
    clinical: "Key anatomical landmark for assessing lower extremity peripheral perfusion, arterial occlusive disease, and vascular catheterization.",
  },
  "organ.kidney.right": {
    description: "A retroperitoneal organ located on the posterior abdominal wall that filters blood to produce urine.",
    function: "Excretes metabolic waste, maintains fluid and electrolyte balance, and participates in blood pressure regulation.",
    location: "Right posterior abdominal cavity (retroperitoneal), situated slightly lower than the left kidney due to the space occupied by the liver.",
    clinical: "Anatomical relationships and renal vasculature are crucial in evaluating renal calculi, hydronephrosis, and retroperitoneal trauma.",
  },
  "bone.hip.right": {
    description: "A large, irregular bone formed by the fusion of the ilium, ischium, and pubis, forming the right pelvic girdle.",
    function: "Transfers body weight from the axial skeleton to the lower limb, provides structural pelvic stability, and forms the hip joint.",
    location: "Lateral and anterior aspect of the pelvis, articulating with the sacrum posteriorly and with the femoral head at the acetabulum laterally.",
    clinical: "Important in evaluating pelvic fractures, hip joint osteoarthritis, acetabular labral pathology, and hip dislocations.",
  },
  "bone.patella.right": {
    description: "A large sesamoid bone situated anterior to the knee joint, embedded within the tendon of the quadriceps femoris muscle.",
    function: "Increases the leverage and mechanical advantage of the quadriceps tendon during knee extension and protects the anterior knee joint.",
    location: "Anterior aspect of the distal femur, articulating with the patellar surface of the femur within the patellofemoral joint.",
    clinical: "Crucial in evaluating patellofemoral pain syndrome, patellar subluxation or dislocation, and extensor mechanism integrity.",
  },
};
