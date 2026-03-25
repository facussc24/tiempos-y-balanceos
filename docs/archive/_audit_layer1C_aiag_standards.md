# AIAG & IATF 16949 Standards: Inspection Frequencies in Control Plans

**Research Date:** 2026-03-21
**Purpose:** Document authoritative standards requirements for inspection frequencies used in Control Plans for automotive headrest manufacturing processes.

---

## Table of Contents

1. [AIAG Control Plan Reference Manual (CP-1, 1st Edition 2024)](#1-aiag-control-plan-reference-manual)
2. [IATF 16949 Clause 8.5.1.1 Requirements](#2-iatf-16949-clause-8511)
3. [CQI-23 Molding System Assessment](#3-cqi-23-molding-system-assessment)
4. [Valid Frequency Types According to AIAG](#4-valid-frequency-types)
5. [Frequency Requirements by Characteristic Type (CC vs SC)](#5-cc-vs-sc-requirements)
6. [FMEA and Control Plan Consistency](#6-fmea-control-plan-consistency)
7. [Typical Frequencies for Headrest Manufacturing Processes](#7-typical-frequencies-headrest-manufacturing)
8. [Specific Questions Answered](#8-specific-questions-answered)
9. [Sources](#9-sources)

---

## 1. AIAG Control Plan Reference Manual

**Manual:** AIAG CP-1:2024 - Control Plan Reference Manual, 1st Edition (March 2024)
**Status:** Now a standalone manual, separated from the APQP manual. Required by GM and Stellantis since September 1, 2024; by Ford since December 31, 2024.

### 1.1 Sample Size Column

The AIAG manual states: When sampling is required, list the corresponding sample size. The number of parts inspected at defined frequency. Sample sizes must be based upon industry standards, statistical sampling plan tables, or other statistical process control methods or techniques.

### 1.2 Sample Frequency Column

The AIAG manual defines the frequency column as: How often measurements/inspection are taken (e.g., every 2 hours, every shift, or every batch).

The manual provides a critical paradigm shift in the 2024 edition:

**Volume-Based Frequency (Key 2024 Concept):**
The sample frequency when not 100% should be volume-based checks. The organization should consider the method of inspection versus impact on the organization for robust containment actions. The volume/quantity of parts run until the next check point determines the frequency, which could imply multiple checks within the same shift as frequency of checks would be defined by volume.

**Effective Containment Principle:**
Frequency of checks for a specific characteristic should be based on the thought process of effective containment actions if a defect were to escape (visual inspection, equipment failure, etc.). The core question to ask: "How many parts can be produced before the next checkpoint while still maintaining the ability to contain any defects that might escape?"

### 1.3 Error-Proofing (EP) Device Verification Frequency

The 2024 manual specifies: Frequency of EP device verification is the ability for effective containment since last "good" verification result (i.e., beginning of each shift). Both EP (Error-Proofing) and MP (Mistake-Proofing) systems must now be verified.

### 1.4 Visual Inspection Validation

The Control Plan must reference periodic validation for visual inspections. Periodic validations can include sampling audit and offline measurements. If 100% visual inspections are included, the method of validation must be identified in work instructions, and the work instruction must also describe how to react to a failure.

### 1.5 Safe Launch Period

The Safe Launch period typically incorporates added inspection items or increased frequency of checks and monitoring and may include tighter control of specification limits. Safe launch is an addendum to the production control plan or identified as a special control period. It does not necessarily require 100% sort -- it is intended to be an enhanced inspection of features selected based on risk and possible impact to the customer. Typical duration: 90 days from start of production.

### 1.6 New RESP Column

An additional "RESP" column has been added to specify who is responsible for carrying out the evaluation/check. This is new in the 2024 edition.

### 1.7 Pass-Through Characteristics (PTCs)

The control plan must document all pass-through characteristics and control methods. This is a new requirement.

**Sources:**
- [AIAG CP-1 Manual Details](https://www.aiag.org/training-and-resources/manuals/details/CP-1)
- [AIAG CP-1:2024 ANSI Webstore](https://webstore.ansi.org/standards/aiag/aiagcp2024)
- [Quality Engineer Stuff - Control Plan Guide](https://qualityengineerstuff.com/doc/control-plan/)
- [simpleQuE - Critical Concepts New CP Manual](https://www.simpleque.com/critical-concepts-to-know-about-the-new-iatf-16949-control-plan-reference-manual/)
- [Knowllence - AIAG CP 1st Ed Implementation](https://www.knowllence.com/en/blog-design-manufacturing/control-plan-apqp.html)

---

## 2. IATF 16949 Clause 8.5.1.1

### 2.1 Core Requirements

IATF 16949:2016 Clause 8.5.1.1 requires organizations to create control plans for each manufacturing site, subsystem, component, or material, covering all products supplied. Family control plans are permissible for bulk materials and similar parts using identical manufacturing processes. Plans should encompass pre-launch and production phases, integrating data from design and manufacturing risk analyses plus process flow diagrams.

### 2.2 Three Phases of Control Plans

1. **Prototype** - Document measurements, materials, and performance tests during prototype development
2. **Pre-launch** - Document measurements with increased frequency and tighter controls before full production; additional inspections and tests may be needed until processes are validated
3. **Production** - Document all product/process characteristics, controls, tests, and measurement systems for ongoing production

### 2.3 Frequency and Sample Size Requirements

The standard requires that control plans detail sample size and frequency using process monitoring and control methods appropriate to each specific manufacturing context. Organizations shall provide measurement, test, and inspection data which demonstrates that control plan requirements, sample sizes, and frequencies are being met when requested.

Sample sizes and frequencies shall be determined based on risk, occurrence of failure modes, and volume, to ensure that the customer is adequately protected from receiving the product before the results of the inspection/tests are known.

### 2.4 Special Characteristics in Control Plans

Control plans must identify and document special characteristics defined by both the customer and the organization and outline how these will be monitored. The methodology requires utilizing System/Design/Process FMEA to determine which characteristics warrant enhanced control.

### 2.5 Review Triggers

Control plans require review and improvement when:
- Nonconforming products ship to customers
- Changes occur affecting product or process
- Customer complaints necessitate corrective actions
- Based on risk analysis at set frequencies

### 2.6 Audit Significance

Clause 8.5.1.1 Control Plan ranks in the top 4 of major and minor audit findings in IATF audits, indicating this is a critical area for compliance.

**Sources:**
- [Pretesh Biswas - IATF 16949 Clause 8.5.1.1](https://preteshbiswas.com/2023/07/31/iatf-169492016-clause-8-5-1-1-control-plan/)
- [simpleQuE - Control Plan Roadmap](https://www.simpleque.com/iatf-16949-control-plan-building-a-roadmap-for-your-product-realization-process/)
- [16949 Store - IATF 16949 Control Plan](https://16949store.com/articles/iatf-16949-control-plan/)
- [IATF Global Oversight - Customer Specific Requirements](https://www.iatfglobaloversight.org/oem-requirements/customer-specific-requirements/)

---

## 3. CQI-23 Molding System Assessment

**Manual:** AIAG CQI-23-2, Special Process: Molding System Assessment, 2nd Edition (February 2023)
**Scope:** Covers plastics molding processes including injection molding. Self-assessment required at minimum once every 12 months.

### 3.1 Process Table A - Injection Molding Monitoring Frequencies

CQI-23 defines specific monitoring frequencies for injection molding parameters. All requirements are subordinate to customer specific requirements, and all frequency requirements refer to active production:

| Parameter | Monitoring Frequency | Control Type |
|-----------|---------------------|--------------|
| Moisture content (material drying) | At start-up and once per shift | Manual |
| Dew point (drying equipment) | Continuous monitoring by controller | Automatic |
| Color change procedures | Once per shift | Automatic |
| Part weight verification | Once every 4 hours | Manual |
| Dimension verification | Start-up, once every 8 hours | Manual |
| Appearance verification | Start-up, once every 8 hours | Manual |
| Melt temperature | Start-up verification | Manual |
| Screw recovery time | Continuous monitoring | Automatic |
| Screw velocity/velocity profile | Continuous automatic monitoring | Automatic |
| Fill time and peak pressure | Continuous monitoring | Automatic |
| Hold pressure and hold time | Continuous monitoring | Automatic |
| Cushion | Continuous monitoring | Automatic |
| Cavity pressure | Continuous monitoring | Automatic |
| Coolant inlet temperature | Continuous monitoring | Automatic |

### 3.2 Key CQI-23 Principles

- All monitoring frequencies refer to active production in the process
- All requirements are subordinate to customer specific requirements (CSR)
- The assessment provides best practices for continual improvement, emphasizing defect prevention and the reduction of variation and waste
- Start-up and restart after downtime events require manual verification

**Important Note:** CQI-23 covers thermoplastic and thermoset injection molding. PU (polyurethane) foam injection is a chemical reaction process, not traditional injection molding, so CQI-23 applies only partially. However, the frequency principles and monitoring philosophy are applicable.

**Sources:**
- [AIAG CQI-23-2 Manual Details](https://www.aiag.org/training-and-resources/manuals/details/CQI-23)
- [CQI Support - CQI-23 Standards](https://www.cqi-support.de/en/cqi_standards/cqi_23)
- [Elsmar Forum - CQI-23 Controls Discussion](https://elsmar.com/elsmarqualityforum/threads/cqi-23-special-process-molding-controls.73105/)
- [Elsmar Forum - CQI-23 Part Weight Control](https://elsmar.com/elsmarqualityforum/threads/cqi-23-molding-system-assessment-control-of-part-weight.78095/)

---

## 4. Valid Frequency Types According to AIAG

Based on AIAG guidance, industry practice, and IATF requirements, the following frequency types are valid in Control Plans:

### 4.1 Categories of Valid Frequencies

**A. Time-Based Frequencies:**
- Every hour / Every 2 hours / Every 4 hours / Every 8 hours
- Once per shift / Twice per shift / X times per shift
- Once per day
- Once per week

**B. Event-Based Frequencies:**
- At start-up / At beginning of shift
- At setup / After setup change
- At lot change / At material batch change
- After tool change / After die change
- At restart after downtime
- First piece / Last piece
- First and last piece of each run
- Buy-off per run (AIAG APQP handbook term for first-piece acceptance after each setup)

**C. Volume-Based Frequencies (Emphasized in 2024 Edition):**
- Every N pieces (e.g., every 50 pieces, every 100 pieces)
- 1st, 25th, and final piece
- 1 per container / 1 per pallet
- X pieces per Y produced

**D. 100% / Continuous:**
- 100% (every piece inspected)
- Continuous (automated monitoring of every cycle)
- Continuous monitoring by controller (for machine parameters)

**E. Statistical Sampling:**
- Per sampling plan (reference to specific plan, e.g., ISO 2859)
- AQL-based sampling
- SPC subgroup frequency (e.g., 5 pieces every 2 hours for Xbar-R chart)

### 4.2 AIAG 2024 Preference: Volume-Based Over Time-Based

The 2024 AIAG Control Plan manual emphasizes that frequency should ideally be volume-based rather than purely time-based. The logic: if your production rate varies, time-based frequency may not provide consistent containment. Volume-based ensures you check a consistent proportion of output regardless of production speed.

However, time-based frequencies remain widely used and accepted, especially for processes with stable production rates.

**Sources:**
- [AIAG CP-1 Manual Details](https://www.aiag.org/training-and-resources/manuals/details/CP-1)
- [How-to Guide - Control Plans](https://controlplan.org/how-to-guide/)
- [SuperEngineer - Control Plan Rules](https://www.superengineer.net/blog/apqp-control-plan)
- [Elsmar Forum - Control Plan Frequency of Sampling](https://elsmar.com/elsmarqualityforum/threads/control-plan-and-the-frequency-of-sampling.84990/)
- [MTG Transform - How to Fill Out a Control Plan](https://www.mtg-transform.com/blog/how-to-fill-out-a-process-control-plan-to-raise-product-quality)
- [Quality-One - Control Plan Development](https://quality-one.com/control-plan/)

---

## 5. Frequency Requirements by Characteristic Type (CC vs SC)

### 5.1 Definitions (IATF 16949 Clause 3.1 and 8.3.3.3)

**Special Characteristic:** A product characteristic or manufacturing process parameter that can affect safety or compliance with regulations, fit, function, performance requirements, or subsequent processing of product.

The two primary sub-categories:

| Category | Symbol | Relates To | Risk Level |
|----------|--------|-----------|------------|
| **Critical Characteristic (CC)** | Various (often inverted delta, shield) | Safety and regulatory compliance | Highest |
| **Significant Characteristic (SC)** | Various (often diamond) | Fit, function, performance, appearance | High |

Note: Symbols vary by OEM. Organizations must comply with customer-specified definitions and symbols or use equivalent notations, with conversion tables provided if requested.

### 5.2 Control and Frequency Differences

According to IATF 16949, the monitoring mechanism (sample size, frequency of inspection) should be relevant to the seriousness of the characteristic. For each special characteristic, an organization has to define controls (Poka Yoke, SPC, 100% inspection) which should be more stringent than normal controls.

**For Critical Characteristics (CC):**
- Typically require 100% inspection OR error-proofing (Poka Yoke) OR continuous monitoring
- When 100% is not feasible, require highest frequency sampling with SPC
- Customer may dictate specific frequency requirements
- Dimensional characteristics identified as Critical require studies at frequencies determined by the customer
- Often require Cpk >= 1.67 (vs 1.33 for standard)

**For Significant Characteristics (SC):**
- Typically require SPC monitoring with regular subgroup sampling
- Sampling frequency based on PFMEA risk assessment
- Common: 5 pieces every 1-2 hours for SPC charts
- May use statistical sampling plans (e.g., ISO 2859 / AQL)
- Standard Cpk >= 1.33

**For Standard (Non-Special) Characteristics:**
- Regular sampling per process capability
- Lower frequency acceptable
- May use audit-based checking

### 5.3 Industry Reality

A common audit finding is that in the majority of control plans, controls and monitoring remain the same irrespective of the characteristics classification (Critical, Major, or Minor). This is a non-conformity -- the IATF standard explicitly requires differentiated controls.

**Sources:**
- [Pretesh Biswas - IATF 16949 Clause 8.3.3.3 Special Characteristics](https://preteshbiswas.com/2023/07/16/iatf-16949-clause-8-3-3-3-special-characteristics/)
- [LinkedIn - Special Characteristics by Bhavya Mangla](https://www.linkedin.com/pulse/special-characteristics-bhavya-mangla)
- [Elsmar Forum - Special Characteristics Classification](https://elsmar.com/elsmarqualityforum/threads/critical-key-significant-characteristics-special-characteristics-classification.36526/)
- [Automotive Qual - Special Characteristics Identification](https://www.automotivequal.com/special-characteristics-and-their-identification-during-new-project-implementation/)

---

## 6. FMEA and Control Plan Consistency

### 6.1 Linkage Requirement

IATF 16949 requires that the Control Plan be consistent with the PFMEA and the Process Flow Diagram. The AIAG-VDA FMEA Handbook (2019) treats the Control Plan as a logical continuation of PFMEA.

### 6.2 Required Consistency Points

1. **Process Step Names/Numbers:** The designation of a given process step in the control plan must match the designation in the P-FMEA and the Process Flow Diagram. This ensures no steps are omitted.

2. **Product Characteristics:** Product characteristics in the Control Plan are linked to potential failure modes (FM) in P-FMEA because failure modes are the product characteristics produced incorrectly.

3. **Detection Controls:** All current prevention/detection controls from the PFMEA should be transferred to the Control Plan. No control should be missed, and special characteristics (SC, CC) should be clearly marked with higher-level controls. If PFMEA recommends a specific detection method (e.g., "Introduce error-proofing sensor"), the Control Plan must include it (e.g., "Sensor check - 100% inline").

4. **Frequency Alignment:** The sampling frequency in the Control Plan should be representative of the risk identified in the FMEA. Higher RPN/AP items warrant higher frequency. Frequency shall be established in the FMEA or control plan per the AIAG-VDA handbook.

### 6.3 Common Audit Findings on Linkage

- Process step numbers/names do not match between PFD, FMEA, and Control Plan
- PFMEA detection controls not reflected in Control Plan
- Frequency in Control Plan not aligned with risk level in PFMEA
- Special characteristics marked differently or missing between documents
- FMEA mistakes are among the most common non-conformities in IATF 16949 audits

### 6.4 Practical Guidance

The control plan needs to include the test frequency of error-proofing devices, with records maintained for the performance of these tests. As new controls are implemented based on PFMEA Step 6 (Optimization), the Control Plan must be updated accordingly.

**Sources:**
- [Quality Assist - FMEA and Control Plan Linkage](https://quasist.com/fmea/fmea-and-control-plan-linkage/)
- [Quality Assist - Prevention and Detection Controls](https://quasist.com/fmea/prevention-and-detection-controls-in-pfmea-to-control-plan/)
- [Elsmar Forum - Linking Control Plans and PFMEAs](https://elsmar.com/elsmarqualityforum/threads/linking-control-plans-and-pfmeas.80339/)
- [Elsmar Forum - Linkages between PFMEA and Control Plan](https://elsmar.com/elsmarqualityforum/threads/linkages-between-pfmea-and-control-plan.87230/)
- [APiS North America - Process Control Plan in FMEA](https://www.apisnorthamerica.com/what-is-a-process-control-plan-how-it-works-with-fmea-to-ensure-quality/)
- [Plexus - Linking FMEA and Control Plan](https://plexusintl.com/us/blog/linking-your-fmea-and-control-plan-higher-performance/)
- [AIAG Blog - Core Tools Overview](https://blog.aiag.org/core-tools-and-iatf-169492016-overview)

---

## 7. Typical Frequencies for Headrest Manufacturing Processes

Based on CQI-23 guidelines, AIAG principles, industry standards, and automotive best practices, the following frequencies are typical for headrest manufacturing:

### 7.1 PU Foam Injection (Polyurethane Reaction Injection)

| Characteristic | Type | Frequency | Method | Justification |
|---------------|------|-----------|--------|---------------|
| Chemical ratio (Polyol/ISO) | Process | Continuous | Flow meter monitoring | CQI-23 principle: continuous for critical process parameters |
| Mold temperature | Process | Continuous | Thermocouple | Machine parameter - continuous monitoring |
| Injection pressure | Process | Continuous | Pressure sensor | Machine parameter - continuous monitoring |
| Gel/cream time | Process | Start-up + every 4 hours | Manual/timer | CQI-23: start-up + periodic verification |
| Foam density | Product CC/SC | Every 2 hours OR per batch | Destructive test / scale | Based on CQI-23 weight check principle (every 4 hrs) |
| Foam hardness (ILD) | Product SC | Per batch/lot OR 1 per shift | Lab test | Requires curing time; lab-based |
| Part weight | Product | Every 2-4 hours | Scale | CQI-23: every 4 hours for part weight |
| Visual appearance (surface) | Product | 100% | Visual | Self-skinning foam requires 100% surface check |
| Dimensions | Product | Start-up + every 8 hours | Go/No-Go gauge or CMM | CQI-23: start-up + every 8 hours |
| Insert position (headrest rod) | Product CC | 100% or error-proofing | Poka Yoke / fixture | Critical safety characteristic |
| Demolding condition | Process | 100% | Visual | Every part checked at demolding |

### 7.2 Fabric Cutting

| Characteristic | Type | Frequency | Method | Justification |
|---------------|------|-----------|--------|---------------|
| Pattern dimensions | Product | First piece + per lot/roll change | Measurement | Setup verification + lot change |
| Material identification | Product | Per lot/roll change | Visual / label check | Incoming material verification |
| Cut quality (edges) | Product | Every 30 min or per batch | Visual | Containment-based frequency |
| Layer alignment | Process | Per setup | Visual / measurement | Setup verification |
| Material defects | Product | 100% (during spreading) | Visual | Standard practice for fabric inspection |

### 7.3 Sewing / Stitching

| Characteristic | Type | Frequency | Method | Justification |
|---------------|------|-----------|--------|---------------|
| Stitch count (per cm/inch) | Product SC | First piece + every 2 hours | Measurement | Process stability check |
| Seam strength | Product CC | Per shift or per lot | Pull test (destructive) | Destructive test limits frequency |
| Thread tension | Process | Start of shift + after thread change | Gauge / visual | Event-based + periodic |
| Pattern alignment | Product | 100% | Visual | Appearance characteristic |
| Seam straightness | Product | 100% | Visual | Every piece visually inspected |
| Thread color match | Product | Per lot/thread change | Visual vs. master | Event-based |
| Needle condition | Process | Every 4 hours or per shift | Visual / replacement schedule | Preventive maintenance |

### 7.4 Visual Inspection (Final Assembly)

| Characteristic | Type | Frequency | Method | Justification |
|---------------|------|-----------|--------|---------------|
| Surface appearance | Product | 100% | Visual vs. boundary samples | Standard for final visual |
| Color match | Product | 100% | Visual vs. master | Standard for appearance |
| Dimensional check | Product CC/SC | Per shift or every 2-4 hours | Go/No-Go gauge | Sampling from 100% visual stream |
| Rod insertion force | Product CC | 100% or per batch | Force gauge | Safety characteristic |
| Label/marking | Product | 100% | Visual | Traceability requirement |
| Contamination/debris | Product | 100% | Visual | Customer requirement |

### 7.5 Packaging / Shipping

| Characteristic | Type | Frequency | Method | Justification |
|---------------|------|-----------|--------|---------------|
| Correct part number | Product | 100% | Visual / scan | Traceability |
| Packaging method | Process | Per container | Visual vs. packaging standard | Per packaging instruction |
| Label accuracy | Product | 100% or per container | Visual / scan | Traceability |
| Quantity per container | Product | Per container | Count | Standard practice |
| Part orientation | Product | Per container | Visual | Damage prevention |
| Shipping documentation | Process | Per shipment | Checklist | Standard practice |

### 7.6 Headrest Assembly Process Reference

For foam-in-place head restraint assembly (the typical headrest manufacturing process): the cut-and-sewn fabric is first placed in a mold and polyurethane chemicals are injected into the mold, and the foam begins to expand to fill the voids of the fabric. This integrated process means several control points are interlinked.

**Sources:**
- [Woodbridge - Foam-In-Place Head Restraint Assembly](https://www.woodbridgegroup.com/Products/Foam-in-Place-Head-Restraint-Assembly)
- [MGA Research - Automotive PU Foam Testing ASTM D3754](https://www.mgaresearch.com/blog/automotive-polyurethane-foam-testing-a-deep-dive-into-astm-d3754)
- [Windsor Machine Group - PU Foam Molding](https://www.windsormachine.com/capabilities/foam/)
- [Textile Blog - In-Process Inspection Garment Manufacturing](https://www.textileblog.com/in-process-inspection-in-garment-manufacturing/)
- [Textile Industry - Sewing Process QC SOP](https://www.textileindustry.net/sewing-process-quality-control-sop/)

---

## 8. Specific Questions Answered

### Q1: What frequency types are valid according to AIAG?

**Answer:** AIAG accepts all of the following frequency types:

1. **Time-based:** Every X hours, per shift, per day (widely used, fully accepted)
2. **Event-based:** At setup, at lot change, at start-up, first/last piece (fully accepted)
3. **100% / Continuous:** For critical characteristics, error-proofing, visual inspection (fully accepted)
4. **Statistical sampling:** Per sampling plan, SPC subgroups (fully accepted)
5. **Volume-based:** Every N pieces, per container (emphasized in 2024 edition as preferred over time-based)

The 2024 edition prefers volume-based when possible but does not prohibit time-based frequencies. The key principle is that frequency must ensure effective containment.

---

### Q2: Would an IATF auditor accept "Cada 2 horas" (Every 2 hours) for a batch injection process?

**Answer:** **Yes, "Every 2 hours" is an acceptable and common frequency.** The AIAG manual itself uses "every 2 hours" as an example of valid frequency entries. CQI-23 uses similar time-based frequencies (e.g., "once every 4 hours" for part weight in injection molding).

However, an IATF auditor would verify:
1. **Risk justification:** Is every 2 hours adequate for the characteristic being checked? Is the frequency aligned with the PFMEA risk level?
2. **Containment capability:** How many parts are produced in 2 hours? Can those parts be effectively contained if a defect is found?
3. **Consistency with PFMEA:** Does the PFMEA detection control support this frequency?
4. **Evidence of compliance:** Are records showing that measurements are actually taken every 2 hours?
5. **CC vs SC distinction:** If it is a Critical Characteristic, the auditor may expect higher frequency (e.g., 100% or continuous) rather than every 2 hours.

For a batch PU injection process producing headrests, "every 2 hours" with appropriate sample size is a reasonable and commonly accepted frequency for Significant Characteristics and standard process parameters.

---

### Q3: Recommended frequencies for specific scenarios

**Start/End of Shift:**
- Error-proofing device verification: Beginning of each shift (per AIAG 2024)
- First piece inspection: Standard practice, widely expected
- Last piece inspection: Common for dimensional characteristics
- Machine parameter verification: At start-up per CQI-23

**Lot Change / Material Change:**
- Raw material verification: At every lot change (event-based)
- First piece after change: Standard practice
- Process parameter re-verification: At every setup/lot change
- CQI-23: Moisture content check at start-up (includes after lot change restart)

**100% for Critical Characteristics (CC):**
- Safety-related dimensions (e.g., headrest rod position): 100% with error-proofing
- Visual defects on safety items: 100% visual
- When 100% is not feasible: Maximum practical frequency with SPC and Cpk >= 1.67
- Automated in-line inspection preferred for CC items

**Sampling for Significant Characteristics (SC):**
- Typical: 5 pieces every 1-2 hours for SPC (Xbar-R charts)
- Alternative: per batch/lot with statistical basis
- Minimum: per shift with adequate sample size
- Must demonstrate process capability (Cpk >= 1.33)

---

### Q4: Is there a difference in frequency requirements for CC vs SC items?

**Answer:** **Yes, absolutely.** IATF 16949 explicitly requires that the monitoring mechanism (sample size, frequency of inspection) should be relevant to the seriousness of the characteristic. The standard requires differentiated controls for different characteristic levels.

| Aspect | Critical (CC) | Significant (SC) | Standard |
|--------|--------------|-------------------|----------|
| **Typical Frequency** | 100% or continuous | Every 1-2 hours / per batch | Per shift or less |
| **Preferred Control** | Error-proofing (Poka Yoke) | SPC monitoring | Sampling plan |
| **Minimum Cpk** | >= 1.67 (common requirement) | >= 1.33 | >= 1.00 |
| **Customer Involvement** | Customer may dictate frequency | Organization determines | Organization determines |
| **Reaction Plan** | Immediate stop + 100% sort | Increased frequency + investigation | Investigation |

A common audit non-conformity is treating all characteristics the same regardless of classification.

---

### Q5: What does AIAG say about frequency consistency between Control Plan and Process FMEA?

**Answer:** AIAG and IATF require consistency between these documents:

1. **Process steps must match** between PFD, PFMEA, and Control Plan (same numbers and names)
2. **Detection controls in PFMEA must appear in Control Plan** as inspection/test methods
3. **Frequency in Control Plan should reflect risk level** identified in PFMEA (higher risk = higher frequency)
4. **Special characteristics must be marked consistently** across all three documents
5. **Control Plan is considered a logical continuation of PFMEA** (per AIAG-VDA FMEA Handbook 2019)
6. **If PFMEA detection rating improves** due to added controls, Control Plan must reflect those controls

Inconsistencies between FMEA and Control Plan are among the most common audit findings in IATF certification audits. The FMEA drives the Control Plan, not the other way around.

---

## 9. Sources

### Standards and Manuals (Official)
1. [AIAG CP-1:2024 - Control Plan Reference Manual](https://www.aiag.org/training-and-resources/manuals/details/CP-1)
2. [AIAG CP-1:2024 at ANSI Webstore](https://webstore.ansi.org/standards/aiag/aiagcp2024)
3. [AIAG CQI-23-2 - Molding System Assessment](https://www.aiag.org/training-and-resources/manuals/details/CQI-23)
4. [AIAG & VDA FMEA Handbook](https://www.aiag.org/training-and-resources/manuals/details/FMEAAV-1)
5. [AIAG Core Tools Overview](https://www.aiag.org/expertise-areas/quality/quality-core-tools)
6. [IATF Global Oversight - Customer Specific Requirements](https://www.iatfglobaloversight.org/oem-requirements/customer-specific-requirements/)
7. [GM Customer Specific Requirements (Jan 2025)](https://www.iatfglobaloversight.org/wp/wp-content/uploads/2025/01/IATF-16949-GM-Customer-Specific-Requirements-January-2025.pdf)
8. [Stellantis CSR for IATF 16949 (2025)](https://www.iatfglobaloversight.org/wp/wp-content/uploads/2025/06/STELLANTIS-CSR-for-use-with-IATF16949-v1.pdf)

### Technical Analysis and Guidance
9. [Pretesh Biswas - IATF 16949 Clause 8.5.1.1 Control Plan](https://preteshbiswas.com/2023/07/31/iatf-169492016-clause-8-5-1-1-control-plan/)
10. [Pretesh Biswas - IATF 16949 Clause 8.3.3.3 Special Characteristics](https://preteshbiswas.com/2023/07/16/iatf-16949-clause-8-3-3-3-special-characteristics/)
11. [simpleQuE - Critical Concepts New CP Manual](https://www.simpleque.com/critical-concepts-to-know-about-the-new-iatf-16949-control-plan-reference-manual/)
12. [simpleQuE - Control Plan Roadmap](https://www.simpleque.com/iatf-16949-control-plan-building-a-roadmap-for-your-product-realization-process/)
13. [simpleQuE - Frequently Overlooked IATF Requirements](https://www.simpleque.com/where-does-it-say-that-frequently-overlooked-iatf-16949-requirements/)
14. [Quality Assist - FMEA and Control Plan Linkage](https://quasist.com/fmea/fmea-and-control-plan-linkage/)
15. [Quality Assist - Prevention and Detection Controls](https://quasist.com/fmea/prevention-and-detection-controls-in-pfmea-to-control-plan/)
16. [Quality Assist - Detection in FMEA](https://quasist.com/fmea/detection-in-fmea/)

### Industry Articles and Discussions
17. [Quality-One - Control Plan Development](https://quality-one.com/control-plan/)
18. [SuperEngineer - Control Plan Rules and Recommendations](https://www.superengineer.net/blog/apqp-control-plan)
19. [16949 Store - IATF 16949 Control Plan](https://16949store.com/articles/iatf-16949-control-plan/)
20. [ControlPlan.org - How-to Guide](https://controlplan.org/how-to-guide/)
21. [Knowllence - AIAG CP 1st Ed Implementation](https://www.knowllence.com/en/blog-design-manufacturing/control-plan-apqp.html)
22. [AIAG Blog - Core Tools and IATF Overview](https://blog.aiag.org/core-tools-and-iatf-169492016-overview)
23. [AIAG Blog - New APQP and CP Implementation](https://blog.aiag.org/the-new-apqp-and-control-plan-will-be-required-by-gm-september-1-2024-and-by-ford-december-31-2024-get-updated-training-and-resources-to-start-preparing-today)
24. [Automotive Qual - Control Plan Development](https://www.automotivequal.com/control-plan-what-you-should-know-during-development/)
25. [Automotive Qual - Pre-Launch Control Plan](https://www.automotivequal.com/pre-launch-control-plan/)
26. [LinkedIn - Special Characteristics](https://www.linkedin.com/pulse/special-characteristics-bhavya-mangla)

### Forum Discussions (Practitioner Experience)
27. [Elsmar Forum - Control Plan Frequency of Sampling](https://elsmar.com/elsmarqualityforum/threads/control-plan-and-the-frequency-of-sampling.84990/)
28. [Elsmar Forum - Linking Control Plans and PFMEAs](https://elsmar.com/elsmarqualityforum/threads/linking-control-plans-and-pfmeas.80339/)
29. [Elsmar Forum - Linkages between PFMEA and Control Plan](https://elsmar.com/elsmarqualityforum/threads/linkages-between-pfmea-and-control-plan.87230/)
30. [Elsmar Forum - FMEA Link to Control Plan Frequency](https://elsmar.com/elsmarqualityforum/threads/fmea-link-to-control-plan-frequency-and-sample-size.83569/page-2)
31. [Elsmar Forum - First Piece Inspection in Control Plan](https://elsmar.com/elsmarqualityforum/threads/is-the-first-piece-inspection-method-supposed-to-be-in-the-control-plan.9946/)
32. [Elsmar Forum - Special Characteristics Classification](https://elsmar.com/elsmarqualityforum/threads/critical-key-significant-characteristics-special-characteristics-classification.36526/)
33. [Elsmar Forum - CQI-23 Controls](https://elsmar.com/elsmarqualityforum/threads/cqi-23-special-process-molding-controls.73105/)
34. [Elsmar Forum - Safe Launch Discussion](https://elsmar.com/elsmarqualityforum/threads/new-product-launch-safe-launch.79967/)

### Headrest Manufacturing References
35. [Woodbridge - Foam-In-Place Head Restraint Assembly](https://www.woodbridgegroup.com/Products/Foam-in-Place-Head-Restraint-Assembly)
36. [MGA Research - Automotive PU Foam Testing ASTM D3754](https://www.mgaresearch.com/blog/automotive-polyurethane-foam-testing-a-deep-dive-into-astm-d3754)
37. [Windsor Machine Group - PU Foam Molding Capabilities](https://www.windsormachine.com/capabilities/foam/)
38. [Chem-Trend - PU Foam Molding Process Guide](https://in.chemtrend.com/news/a-guide-to-the-polyurethane-foam-molding-process-steps/)

### Additional Quality Resources
39. [IQA System - Common FMEA Mistakes](https://www.iqasystem.com/news/fmea-common-mistakes/)
40. [Plexus - Linking FMEA and Control Plan](https://plexusintl.com/us/blog/linking-your-fmea-and-control-plan-higher-performance/)
41. [APiS North America - Process Control Plan in FMEA](https://www.apisnorthamerica.com/what-is-a-process-control-plan-how-it-works-with-fmea-to-ensure-quality/)
42. [Advisera - IATF 16949 Control Plan Development](https://advisera.com/16949academy/blog/2017/09/27/how-to-develop-a-control-plan-according-to-iatf-16949/)
43. [MTG Transform - How to Fill Out a Control Plan](https://www.mtg-transform.com/blog/how-to-fill-out-a-process-control-plan-to-raise-product-quality)
44. [CQI Support - CQI-23 Standards Overview](https://www.cqi-support.de/en/cqi_standards/cqi_23)

---

## Summary of Key Findings

1. **AIAG 2024 prefers volume-based frequency** but time-based (e.g., "every 2 hours") remains fully valid and is used as an example in the manual itself.

2. **"Every 2 hours" is acceptable** for batch injection processes, provided it is justified by risk analysis and ensures effective containment.

3. **CC and SC require different frequencies** -- this is an explicit IATF requirement, not optional. CC items typically need 100% or continuous monitoring; SC items need SPC or enhanced sampling.

4. **FMEA and Control Plan must be consistent** -- this is one of the top audit finding areas. Process steps, detection methods, and frequency levels must align.

5. **CQI-23 provides specific benchmark frequencies** for injection molding that can be referenced: part weight every 4 hours, dimensions at start-up + every 8 hours, machine parameters continuous.

6. **Event-based frequencies** (start-up, lot change, setup change) are not only valid but often required alongside time-based frequencies.

7. **Safe launch periods** use enhanced frequency (typically additional checkpoints above production control plan levels) for approximately 90 days.
