export interface ClassificationResult {
  system: string;
  tissueType: string;
}

/**
 * Deterministic, conservative classification rules for BodyParts3D anatomical concepts.
 * Keeps system and tissueType independent.
 * Falls back to "other" / "other" if ambiguous.
 */
export function classifyAnatomicalTerm(englishName: string): ClassificationResult {
  const lower = englishName.toLowerCase();

  // 1. Skeletal System & Bone/Cartilage Tissue
  if (
    /\b(bone|skeleton|vertebra|vertebrae|rib|skull|femur|tibia|fibula|patella|clavicle|scapula|humerus|radius|ulna|pelvis|ilium|ischium|pubis|sacrum|coccyx|calcaneus|talus|phalanx|phalanges|metatarsal|metatarsals|metacarpal|metacarpals|carpal|carpals|tarsal|tarsals|mandible|maxilla|cranium|sternum|hyoid|sphenoid|ethmoid|lacrimal bone|zygomatic|nasal bone|vomer|palatine|parietal|temporal|frontal bone|occipital|costal cartilage|articular cartilage|intervertebral disc|suture|joint|epiphysis|diaphysis)\b/i.test(
      lower
    )
  ) {
    return { system: "skeletal", tissueType: "bone" };
  }

  // 2. Muscular System & Muscle Tissue
  if (
    /\b(muscle|muscles|musculus|musculi|sartorius|gluteus|quadriceps|biceps|triceps|deltoid|pectoralis|gastrocnemius|soleus|trapezius|latissimus|rectus|vastus|gracilis|tibialis|peroneus|fibularis|pronator|supinator|flexor|extensor|abductor|adductor|levator|depressor|sphincter|masseter|temporalis|pterygoid|diaphragm|tendon|aponeurosis|fascia)\b/i.test(
      lower
    )
  ) {
    return { system: "muscular", tissueType: "muscle" };
  }

  // 3. Nervous System & Nerve/Brain Tissue
  if (
    /\b(nerve|nerves|nervus|nervi|brain|cerebrum|cerebellum|spinal cord|medulla|pons|thalamus|hypothalamus|hippocampus|ganglion|ganglia|plexus|optic chiasm|retina|tract|tractus|cortex|gyrus|sulcus|ventricle of brain|corpus callosum|dura mater|pia mater|arachnoid mater|meninx|meninges)\b/i.test(
      lower
    )
  ) {
    return { system: "nervous", tissueType: "nerve" };
  }

  // 4. Vascular / Cardiovascular System & Vessel Tissue
  if (
    /\b(artery|arteries|arteria|arteriae|vein|veins|vena|venae|aorta|arteriole|arterioles|venule|venules|vascular|sinus|atrium|ventricle of heart|valve of heart|pericardium|endocardium|myocardium|capillary|capillaries|trunk|anastomosis)\b/i.test(
      lower
    )
  ) {
    return { system: "vascular", tissueType: "vessel" };
  }

  // 5. Organ / Visceral System (Digestive, Respiratory, Urinary, Reproductive, Endocrine)
  if (
    /\b(kidney|liver|lung|lungs|heart|stomach|pancreas|spleen|bladder|gallbladder|thyroid|thymus|prostate|uterus|ovary|ovaries|testis|testes|intestine|colon|duodenum|jejunum|ileum|cecum|appendix|rectum|esophagus|trachea|bronchus|bronchi|larynx|pharynx|tonsil|parotid|submandibular|sublingual|ureter|urethra|suprarenal|adrenal|pituitary)\b/i.test(
      lower
    )
  ) {
    return { system: "organ", tissueType: "organ" };
  }

  // 6. Conservative Fallback
  return { system: "other", tissueType: "other" };
}
