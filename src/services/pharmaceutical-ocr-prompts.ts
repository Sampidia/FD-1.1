/**
 * Specialized OCR Prompts for Pharmaceutical Products
 * Optimized prompts for different pharmaceutical forms and packaging types
 */

export type PharmaceuticalForm =
  | 'tablets'
  | 'capsules'
  | 'injectables'
  | 'syrups'
  | 'creams'
  | 'inhalers'
  | 'patches'
  | 'drops'
  | 'suppositories'
  | 'sprays'
  | 'general';

export interface OCRPromptConfig {
  form: PharmaceuticalForm;
  primary: string;
  fallback: string;
  patterns: {
    batchNumbers: (string | RegExp)[];
    expiryFormats: string[];
    manufacturerCodes: (string | RegExp)[];
  };
}

export class PharmaceuticalOCRPrompts {
  private static readonly BATCH_NUMBER_PATTERNS = [
    // Nigerian/Common patterns
    'T36184B', 'UI4004', 'PCT2023002', '39090439', 'A203464B',
    // European patterns
    'BAC789474', 'EU123456', 'CE012345', 'ISO90012015',
    // WHO compliant patterns
    'WHP123456', 'GMP789012', 'NAFDAC123',
    // Generic alphanumeric patterns
      /[A-Z]{1,3}\d{4,8}[A-Z]?/, /[A-Z]\d{5,6}[A-Z]/,
      // Alphabetic batch patterns (like ASCORBIC2023)
      /[A-Z]{4,10}\d{4}/,
      // Space-separated patterns
      /[A-Z]{2,4}\s*\d{4,6}[A-Z]?/, /\d{2}\s*\d{4}[A-Z]/,
      // Date-based batch patterns
      /2[0-9]{3}[0-1][0-9][0-3][0-9]/, /2[0-9]{3}[A-Z]{1,2}\d{1,3}/
  ];

  private static readonly EXPIRY_DATE_PATTERNS = [
    // Standard formats
    'MM/YYYY', 'MM/YY', 'MM-YYYY', 'MM-YY',
    'DD/MM/YYYY', 'DD/MM/YY', 'DD-MM-YYYY', 'DD-MM-YY',
    'YYYY-MM-DD', 'YY-MM-DD',
    // Text formats
    'EXP MM/YYYY', 'EXPIRY MM/YYYY', 'BEST BEFORE MM/YYYY',
    'USE BY MM/YYYY', 'EXPIRES MM/YYYY',
    // Month abbreviations
    'JAN/2024', 'FEBRUARY 2024', 'MAR 24',
    // International formats
    '2024-12-31', '31.12.2024', '12/2024'
  ];

  private static readonly MANUFACTURER_PATTERERS = [
    // Common pharmaceutical company patterns
    'Pfizer', 'GSK', 'Novartis', 'Roche', 'Merck', 'Johnson & Johnson',
    'AstraZeneca', 'Sanofi', 'Bayer', 'Abbott', 'Eli Lilly',
    // Nigerian manufacturers
    'Emzor', 'May & Baker', 'Swiss Pharma', 'Juhel', 'Pharma Deko',
    // Generic patterns
    /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(Ltd|PLC|Inc|Corp|GmbH|SA|NV)/,
    /[A-Z]{2,4}\s+Pharma(?:ceuticals)?/, /[A-Z]{2,4}\s+Labs?/
  ];

  // Specialized prompts for different pharmaceutical forms
  private static readonly PROMPTS: Record<PharmaceuticalForm, OCRPromptConfig> = {
    tablets: {
      form: 'tablets',
      primary: `EXTRACT PHARMACEUTICAL TABLET INFORMATION with precision:

CRITICAL ELEMENTS (prioritize in this order):
1. PRODUCT NAME: Full brand/generic name (e.g., "Paracetamol 500mg Tablets")
2. STRENGTH/DOSAGE: mg/mcg/IU amount (e.g., "500mg", "1000IU")
3. BATCH NUMBER: Look for patterns like ASCORBIC2023, T36184B, UI4004, PCT2023002, 39090439
4. EXPIRY DATE: MM/YYYY, EXP MM/YY, Best Before formats
5. MANUFACTURER: Company name and location
6. PACK SIZE: Number of tablets per pack/blister
7. REGISTRATION NUMBER: NAFDAC registration if visible

TABLET-SPECIFIC PATTERNS:
- Embossed/engraved text on tablets
- Blister foil printing
- Bottle labels and inserts
- Strip packaging markings

EXTRACTION RULES:
- Read ALL visible text, including small print
- Look for text on tablet surfaces, not just labels
- Check for multiple languages (English/French/Arabic)
- Note any special markings or symbols
- Extract complete product names without abbreviations

CONFIDENCE SCORING:
- High confidence: Name + strength + batch + expiry found
- Medium confidence: Name + batch/expiry found
- Low confidence: Partial information only`,
      fallback: `Quick tablet scan: Extract product name (with strength), batch number, and expiry date from pharmaceutical tablet packaging.`,
      patterns: {
        batchNumbers: PharmaceuticalOCRPrompts.BATCH_NUMBER_PATTERNS,
        expiryFormats: PharmaceuticalOCRPrompts.EXPIRY_DATE_PATTERNS,
        manufacturerCodes: PharmaceuticalOCRPrompts.MANUFACTURER_PATTERERS
      }
    },

    capsules: {
      form: 'capsules',
      primary: `EXTRACT PHARMACEUTICAL CAPSULE INFORMATION:

FOCUS AREAS:
1. PRODUCT NAME: Brand and generic names
2. STRENGTH: mg/mcg/IU dosage (e.g., "250mg", "500mcg")
3. BATCH NUMBER: Capsule-specific codes (often printed on capsule bodies)
4. EXPIRY DATE: Label expiry information
5. MANUFACTURER: Capsule filler company
6. CAPSULE TYPE: Hard/soft gel, color coding
7. PACK SIZE: Number of capsules per container

CAPSULE CHARACTERISTICS:
- Gelatin coating text
- Color-coded capsule bodies
- Imprinted capsule markings
- Bottle and blister labeling
- Enteric coating indicators
- Controlled release designations

SPECIAL ATTENTION:
- Check capsule body versus cap printing
- Note color combinations and their meanings
- Look for size designations (00, 0, 1, 2, 3, 4, 5)
- Identify modified release formulations`,
      fallback: `Capsule scan: Extract name (with strength), batch number, expiry, and manufacturer from capsule packaging.`,
      patterns: {
        batchNumbers: PharmaceuticalOCRPrompts.BATCH_NUMBER_PATTERNS,
        expiryFormats: PharmaceuticalOCRPrompts.EXPIRY_DATE_PATTERNS,
        manufacturerCodes: PharmaceuticalOCRPrompts.MANUFACTURER_PATTERERS
      }
    },

    injectables: {
      form: 'injectables',
      primary: `EXTRACT INJECTABLE PHARMACEUTICAL INFORMATION:

CRITICAL DATA POINTS:
1. PRODUCT NAME: Vaccine/drug name and formulation
2. STRENGTH/CONCENTRATION: mg/ml, IU/ml, etc.
3. BATCH NUMBER: Vial/ampule specific codes
4. EXPIRY DATE: Critical for injectables
5. MANUFACTURER: Vaccine/drug manufacturer
6. VOLUME: ml per vial/ampule
7. STORAGE CONDITIONS: Temperature requirements
8. ADMINISTRATION: Route and dosage instructions

INJECTABLE FORMATS:
- Glass vials and ampules
- Pre-filled syringes
- Multi-dose vials
- Lyophilized powders
- Vaccine-specific labeling
- Emergency medication indicators

SAFETY CHECKS:
- Verify tamper-evident seals
- Check for cold chain indicators
- Note reconstitution requirements
- Identify diluent information
- Look for storage warnings

REGULATORY INFORMATION:
- Lot numbers and serial numbers
- NAFDAC registration numbers
- WHO prequalification status
- Emergency use authorization markers`,
      fallback: `Injectable scan: Extract name, strength, batch, expiry, volume, and manufacturer from vial/ampule labeling.`,
      patterns: {
        batchNumbers: PharmaceuticalOCRPrompts.BATCH_NUMBER_PATTERNS,
        expiryFormats: PharmaceuticalOCRPrompts.EXPIRY_DATE_PATTERNS,
        manufacturerCodes: PharmaceuticalOCRPrompts.MANUFACTURER_PATTERERS
      }
    },

    syrups: {
      form: 'syrups',
      primary: `EXTRACT SYRUP/ORAL SOLUTION INFORMATION:

ESSENTIAL ELEMENTS:
1. PRODUCT NAME: Brand and generic names
2. STRENGTH/CONCENTRATION: mg/ml, mg/5ml dosage
3. BATCH NUMBER: Bottle-specific codes
4. EXPIRY DATE: Critical for liquids
5. MANUFACTURER: Syrup producer
6. VOLUME: Total volume in bottle
7. DOSAGE MEASURING: Instructions for administration

SYRUP CHARACTERISTICS:
- Bottle cap and neck labeling
- Measurement markings on bottles
- Tamper-evident caps
- Shake well indicators
- Refrigeration requirements
- Pediatric dosing information

SPECIAL CONSIDERATIONS:
- Check for concentration variations
- Note flavor/color additives
- Identify preservative information
- Look for measuring device requirements
- Check for alcohol content warnings`,
      fallback: `Syrup scan: Extract name, concentration, batch, expiry, volume, and manufacturer from syrup bottle labeling.`,
      patterns: {
        batchNumbers: PharmaceuticalOCRPrompts.BATCH_NUMBER_PATTERNS,
        expiryFormats: PharmaceuticalOCRPrompts.EXPIRY_DATE_PATTERNS,
        manufacturerCodes: PharmaceuticalOCRPrompts.MANUFACTURER_PATTERERS
      }
    },

    creams: {
      form: 'creams',
      primary: `EXTRACT TOPICAL CREAM/OINTMENT INFORMATION:

KEY INFORMATION:
1. PRODUCT NAME: Brand and generic names
2. STRENGTH: % concentration or mg/g
3. BATCH NUMBER: Tube/container codes
4. EXPIRY DATE: Critical for compounded products
5. MANUFACTURER: Cream producer
6. NET WEIGHT/VOLUME: Tube/container size
7. APPLICATION: Usage instructions

CREAM CHARACTERISTICS:
- Tube and jar labeling
- Tamper-evident seals
- Pump dispenser information
- Storage conditions
- Application frequency
- Warning labels for sensitive areas

ADDITIONAL DETAILS:
- Base type (water-based, oil-based)
- Active ingredients list
- Preservative information
- pH level indicators
- Sterility indicators for ophthalmic products`,
      fallback: `Cream scan: Extract name, strength, batch, expiry, weight, and manufacturer from cream/ointment packaging.`,
      patterns: {
        batchNumbers: PharmaceuticalOCRPrompts.BATCH_NUMBER_PATTERNS,
        expiryFormats: PharmaceuticalOCRPrompts.EXPIRY_DATE_PATTERNS,
        manufacturerCodes: PharmaceuticalOCRPrompts.MANUFACTURER_PATTERERS
      }
    },

    inhalers: {
      form: 'inhalers',
      primary: `EXTRACT INHALER/METERED DOSE INFORMATION:

CRITICAL ELEMENTS:
1. PRODUCT NAME: Brand and generic names
2. STRENGTH: mcg per actuation/puff
3. BATCH NUMBER: Canister-specific codes
4. EXPIRY DATE: Critical for respiratory medications
5. MANUFACTURER: Device manufacturer
6. DOSES: Total doses per canister
7. PRIMING: Device preparation instructions

INHALER FEATURES:
- Canister labeling and color coding
- Dose counter information
- Spacer/holding chamber compatibility
- Storage orientation requirements
- Cleaning instructions
- Disposal information

DEVICE-SPECIFIC:
- DPI vs pMDI identification
- Multi-dose vs single-dose indicators
- Temperature sensitivity warnings
- Humidity protection requirements`,
      fallback: `Inhaler scan: Extract name, strength, batch, expiry, doses, and manufacturer from inhaler canister labeling.`,
      patterns: {
        batchNumbers: PharmaceuticalOCRPrompts.BATCH_NUMBER_PATTERNS,
        expiryFormats: PharmaceuticalOCRPrompts.EXPIRY_DATE_PATTERNS,
        manufacturerCodes: PharmaceuticalOCRPrompts.MANUFACTURER_PATTERERS
      }
    },

    patches: {
      form: 'patches',
      primary: `EXTRACT TRANSDERMAL PATCH INFORMATION:

ESSENTIAL DATA:
1. PRODUCT NAME: Brand and generic names
2. STRENGTH: mg per patch, mcg/hour release rate
3. BATCH NUMBER: Patch-specific codes
4. EXPIRY DATE: Critical for transdermal products
5. MANUFACTURER: Patch producer
6. PATCH SIZE: Active surface area
7. WEAR TIME: Application duration

PATCH CHARACTERISTICS:
- Individual pouch labeling
- Multi-pack information
- Application site restrictions
- Removal and disposal instructions
- Storage conditions
- Child safety features

TECHNICAL DETAILS:
- Delivery system type (matrix, reservoir)
- Release rate specifications
- Adhesive type and strength
- Waterproof properties
- MRI compatibility warnings`,
      fallback: `Patch scan: Extract name, strength, batch, expiry, size, and manufacturer from transdermal patch packaging.`,
      patterns: {
        batchNumbers: PharmaceuticalOCRPrompts.BATCH_NUMBER_PATTERNS,
        expiryFormats: PharmaceuticalOCRPrompts.EXPIRY_DATE_PATTERNS,
        manufacturerCodes: PharmaceuticalOCRPrompts.MANUFACTURER_PATTERERS
      }
    },

    drops: {
      form: 'drops',
      primary: `EXTRACT EYE/EAR DROP INFORMATION:

CRITICAL ELEMENTS:
1. PRODUCT NAME: Ophthalmic/otic preparation names
2. STRENGTH: % concentration or mg/ml
3. BATCH NUMBER: Multi-dose container codes
4. EXPIRY DATE: Critical after opening
5. MANUFACTURER: Ophthalmic/otic manufacturer
6. VOLUME: Total volume in container
7. DROP SIZE: Administration information

DROP CHARACTERISTICS:
- Preservative-free indicators
- Contact lens compatibility
- pH and tonicity information
- Storage after opening
- Administration frequency
- Shake well requirements

SAFETY INFORMATION:
- Sterility indicators
- Single patient use warnings
- Discard date after opening
- Contamination prevention
- Child-resistant caps`,
      fallback: `Drops scan: Extract name, strength, batch, expiry, volume, and manufacturer from eye/ear drop container labeling.`,
      patterns: {
        batchNumbers: PharmaceuticalOCRPrompts.BATCH_NUMBER_PATTERNS,
        expiryFormats: PharmaceuticalOCRPrompts.EXPIRY_DATE_PATTERNS,
        manufacturerCodes: PharmaceuticalOCRPrompts.MANUFACTURER_PATTERERS
      }
    },

    suppositories: {
      form: 'suppositories',
      primary: `EXTRACT SUPPOSITORY INFORMATION:

KEY ELEMENTS:
1. PRODUCT NAME: Rectal/vaginal suppository names
2. STRENGTH: mg per suppository
3. BATCH NUMBER: Suppository-specific codes
4. EXPIRY DATE: Critical for stability
5. MANUFACTURER: Suppository producer
6. COUNT: Number per pack
7. STORAGE: Temperature requirements

SUPPOSITORY FEATURES:
- Individual foil wrapping
- Bulk packaging information
- Insertion instructions
- Lubrication requirements
- Storage orientation
- Shape and size indicators

SPECIAL CHARACTERISTICS:
- Rectal vs vaginal use indicators
- Controlled temperature storage
- Light protection requirements
- Moisture sensitivity warnings`,
      fallback: `Suppository scan: Extract name, strength, batch, expiry, count, and manufacturer from suppository packaging.`,
      patterns: {
        batchNumbers: PharmaceuticalOCRPrompts.BATCH_NUMBER_PATTERNS,
        expiryFormats: PharmaceuticalOCRPrompts.EXPIRY_DATE_PATTERNS,
        manufacturerCodes: PharmaceuticalOCRPrompts.MANUFACTURER_PATTERERS
      }
    },

    sprays: {
      form: 'sprays',
      primary: `EXTRACT NASAL/SPRAY INFORMATION:

ESSENTIAL DATA:
1. PRODUCT NAME: Nasal spray/medicated spray names
2. STRENGTH: mcg per spray, % concentration
3. BATCH NUMBER: Spray container codes
4. EXPIRY DATE: Critical for aerosols
5. MANUFACTURER: Spray device manufacturer
6. SPRAYS: Total doses per container
7. PRIMING: Initial spray requirements

SPRAY CHARACTERISTICS:
- Pump mechanism information
- Priming and shaking requirements
- Storage orientation
- Temperature sensitivity
- Humidity protection
- Child safety features

TECHNICAL DETAILS:
- Metered dose specifications
- Particle size information
- Propellant type and safety
- Environmental disposal requirements`,
      fallback: `Spray scan: Extract name, strength, batch, expiry, sprays, and manufacturer from nasal/spray container labeling.`,
      patterns: {
        batchNumbers: PharmaceuticalOCRPrompts.BATCH_NUMBER_PATTERNS,
        expiryFormats: PharmaceuticalOCRPrompts.EXPIRY_DATE_PATTERNS,
        manufacturerCodes: PharmaceuticalOCRPrompts.MANUFACTURER_PATTERERS
      }
    },

    general: {
      form: 'general',
      primary: `EXTRACT GENERAL PHARMACEUTICAL INFORMATION:

STANDARD ELEMENTS:
1. PRODUCT NAME: Brand and generic names
2. STRENGTH/DOSAGE: Any concentration or amount
3. BATCH NUMBER: Any alphanumeric code
4. EXPIRY DATE: Any date format
5. MANUFACTURER: Company name
6. PACK SIZE: Quantity information
7. FORM: Tablet, capsule, liquid, etc.

GENERAL PATTERNS:
- Standard pharmaceutical labeling
- Regulatory markings
- Warning labels
- Usage instructions
- Storage information

FALLBACK EXTRACTION:
- Look for any identifying marks
- Note unusual packaging features
- Extract any regulatory numbers
- Identify language and region indicators`,
      fallback: `General pharmaceutical scan: Extract name, strength, batch, expiry, and manufacturer from any pharmaceutical packaging.`,
      patterns: {
        batchNumbers: PharmaceuticalOCRPrompts.BATCH_NUMBER_PATTERNS,
        expiryFormats: PharmaceuticalOCRPrompts.EXPIRY_DATE_PATTERNS,
        manufacturerCodes: PharmaceuticalOCRPrompts.MANUFACTURER_PATTERERS
      }
    }
  };

  /**
   * Get optimized prompt for specific pharmaceutical form
   */
  static getPrompt(form: PharmaceuticalForm = 'general', useFallback: boolean = false): string {
    const config = this.PROMPTS[form] || this.PROMPTS.general;
    return useFallback ? config.fallback : config.primary;
  }

  /**
   * Get all available pharmaceutical forms
   */
  static getAvailableForms(): PharmaceuticalForm[] {
    return Object.keys(this.PROMPTS) as PharmaceuticalForm[];
  }

  /**
   * Get pattern recognition hints for a specific form
   */
  static getPatterns(form: PharmaceuticalForm = 'general') {
    const config = this.PROMPTS[form] || this.PROMPTS.general;
    return config.patterns;
  }

  /**
   * Auto-detect pharmaceutical form from initial OCR results
   */
  static detectForm(initialText: string): PharmaceuticalForm {
    const text = initialText.toLowerCase();

    // Detection rules based on common keywords and patterns
    if (text.includes('tablet') || text.includes('tab') || text.match(/\d+\s*mg\s*tablet/i)) {
      return 'tablets';
    }
    if (text.includes('capsule') || text.includes('cap') || text.includes('softgel')) {
      return 'capsules';
    }
    if (text.includes('injection') || text.includes('vial') || text.includes('ampoule') || text.includes('syringe')) {
      return 'injectables';
    }
    if (text.includes('syrup') || text.includes('suspension') || text.includes('solution') || text.includes('oral')) {
      return 'syrups';
    }
    if (text.includes('cream') || text.includes('ointment') || text.includes('gel') || text.includes('lotion')) {
      return 'creams';
    }
    if (text.includes('inhaler') || text.includes('aerosol') || text.includes('mdi') || text.includes('dpi')) {
      return 'inhalers';
    }
    if (text.includes('patch') || text.includes('transdermal') || text.includes('matrix')) {
      return 'patches';
    }
    if (text.includes('drop') || text.includes('eye') || text.includes('ear') || text.includes('otic')) {
      return 'drops';
    }
    if (text.includes('suppository') || text.includes('rectal') || text.includes('vaginal')) {
      return 'suppositories';
    }
    if (text.includes('spray') || text.includes('nasal') || text.includes('pump')) {
      return 'sprays';
    }

    return 'general';
  }

  /**
   * Get enhanced prompt with context-specific optimizations
   */
  static getEnhancedPrompt(
    form: PharmaceuticalForm = 'general',
    userPlan: string = 'free',
    imageCount: number = 1
  ): string {
    const basePrompt = this.getPrompt(form, false);

    // Add plan-specific optimizations
    let planOptimizations = '';
    if (userPlan === 'business') {
      planOptimizations = '\n\nHIGH PRECISION MODE: Pay extra attention to regulatory markings, exact batch formats, and manufacturer codes.';
    } else if (userPlan === 'standard') {
      planOptimizations = '\n\nSTANDARD ACCURACY MODE: Focus on complete information extraction with confidence scoring.';
    }

    // Add multi-image context
    let imageContext = '';
    if (imageCount > 1) {
      imageContext = `\n\nMULTI-IMAGE ANALYSIS: You have ${imageCount} images. Cross-reference information across all images for maximum accuracy.`;
    }

    return basePrompt + planOptimizations + imageContext;
  }
}

// Convenience functions for common use cases
export const getPharmaPrompt = PharmaceuticalOCRPrompts.getPrompt.bind(PharmaceuticalOCRPrompts);
export const getPharmaPatterns = PharmaceuticalOCRPrompts.getPatterns.bind(PharmaceuticalOCRPrompts);
export const detectPharmaForm = PharmaceuticalOCRPrompts.detectForm.bind(PharmaceuticalOCRPrompts);
export const getEnhancedPharmaPrompt = PharmaceuticalOCRPrompts.getEnhancedPrompt.bind(PharmaceuticalOCRPrompts);