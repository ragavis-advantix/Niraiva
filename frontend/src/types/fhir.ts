// FHIR R4 Type Definitions for Patient POV

export type CodeableConcept = {
    coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
    }>;
    text?: string;
};

export type Reference = {
    reference?: string;
    type?: string;
    identifier?: {
        system?: string;
        value?: string;
    };
    display?: string;
};

export type Coding = {
    system?: string;
    version?: string;
    code?: string;
    display?: string;
    userSelected?: boolean;
};

export type HumanName = {
    use?: "usual" | "official" | "temp" | "nickname" | "anonymous" | "old" | "maiden";
    text?: string;
    family?: string;
    given?: string[];
    prefix?: string[];
    suffix?: string[];
    period?: {
        start?: string;
        end?: string;
    };
};

export type ContactPoint = {
    system?: "phone" | "fax" | "email" | "pager" | "url" | "sms" | "other";
    value?: string;
    use?: "home" | "work" | "temp" | "old" | "mobile";
    rank?: number;
    period?: {
        start?: string;
        end?: string;
    };
};

export type Address = {
    use?: "home" | "work" | "temp" | "old" | "billing";
    type?: "postal" | "physical" | "both";
    text?: string;
    line?: string[];
    city?: string;
    district?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    period?: {
        start?: string;
        end?: string;
    };
};

export type Attachment = {
    contentType?: string;
    language?: string;
    data?: string;
    url?: string;
    size?: number;
    hash?: string;
    title?: string;
    creation?: string;
    height?: number;
    width?: number;
    frames?: number;
    duration?: number;
};

export type Identifier = {
    use?: "usual" | "official" | "temp" | "secondary" | "old";
    type?: CodeableConcept;
    system?: string;
    value?: string;
    period?: {
        start?: string;
        end?: string;
    };
    assigner?: Reference;
};

// Patient Resource
export interface Patient {
    resourceType: "Patient";
    id?: string;
    identifier?: Identifier[];
    active?: boolean;
    name?: HumanName[];
    telecom?: ContactPoint[];
    gender?: "male" | "female" | "other" | "unknown";
    birthDate?: string;
    address?: Address[];
    maritalStatus?: CodeableConcept;
    contact?: Array<{
        relationship?: CodeableConcept[];
        name?: HumanName;
        telecom?: ContactPoint[];
        address?: Address;
        gender?: string;
        organization?: Reference;
        period?: {
            start?: string;
            end?: string;
        };
    }>;
    meta?: {
        versionId?: string;
        lastUpdated?: string;
        source?: string;
    };
}

// Observation Resource
export interface Observation {
    resourceType: "Observation";
    id?: string;
    identifier?: Identifier[];
    basedOn?: Reference[];
    status: "registered" | "preliminary" | "final" | "amended" | "corrected" | "cancelled" | "entered-in-error" | "unknown";
    category?: CodeableConcept[];
    code: CodeableConcept;
    subject?: Reference;
    focus?: Reference[];
    encounter?: Reference;
    effectiveDateTime?: string;
    effectivePeriod?: {
        start?: string;
        end?: string;
    };
    issued?: string;
    performer?: Reference[];
    valueQuantity?: {
        value?: number;
        comparator?: string;
        unit?: string;
        system?: string;
        code?: string;
    };
    valueCodeableConcept?: CodeableConcept;
    valueString?: string;
    valueBoolean?: boolean;
    valueInteger?: number;
    valueRange?: {
        low?: {
            value?: number;
            unit?: string;
        };
        high?: {
            value?: number;
            unit?: string;
        };
    };
    valueRatio?: {
        numerator?: {
            value?: number;
            unit?: string;
        };
        denominator?: {
            value?: number;
            unit?: string;
        };
    };
    valueSampledData?: {
        origin?: {
            value?: number;
            unit?: string;
        };
        period?: number;
        factor?: number;
        lowerLimit?: number;
        upperLimit?: number;
        dimensions: number;
        data?: string;
    };
    valueTime?: string;
    valueDateTime?: string;
    valuePeriod?: {
        start?: string;
        end?: string;
    };
    dataAbsentReason?: CodeableConcept;
    interpretation?: CodeableConcept[];
    note?: Array<{
        text?: string;
        time?: string;
    }>;
    bodySite?: CodeableConcept;
    method?: CodeableConcept;
    specimen?: Reference;
    device?: Reference;
    referenceRange?: Array<{
        low?: {
            value?: number;
            unit?: string;
        };
        high?: {
            value?: number;
            unit?: string;
        };
        type?: CodeableConcept;
        appliesTo?: CodeableConcept[];
        age?: {
            low?: {
                value?: number;
                unit?: string;
            };
            high?: {
                value?: number;
                unit?: string;
            };
        };
        text?: string;
    }>;
    hasMember?: Reference[];
    derivedFrom?: Reference[];
    component?: Array<{
        code: CodeableConcept;
        valueQuantity?: {
            value?: number;
            unit?: string;
        };
        valueCodeableConcept?: CodeableConcept;
        valueString?: string;
        valueBoolean?: boolean;
        valueInteger?: number;
        valueRange?: unknown;
        valueRatio?: unknown;
        valueSampledData?: unknown;
        valueTime?: string;
        valueDateTime?: string;
        valuePeriod?: unknown;
        dataAbsentReason?: CodeableConcept;
        interpretation?: CodeableConcept[];
        referenceRange?: unknown[];
    }>;
}

// Condition Resource
export interface Condition {
    resourceType: "Condition";
    id?: string;
    identifier?: Identifier[];
    clinicalStatus?: CodeableConcept;
    verificationStatus?: CodeableConcept;
    category?: CodeableConcept[];
    severity?: CodeableConcept;
    code: CodeableConcept;
    bodySite?: CodeableConcept[];
    subject: Reference;
    encounter?: Reference;
    onsetDateTime?: string;
    onsetAge?: {
        value?: number;
        unit?: string;
    };
    onsetPeriod?: {
        start?: string;
        end?: string;
    };
    onsetRange?: {
        low?: {
            value?: number;
        };
        high?: {
            value?: number;
        };
    };
    onsetString?: string;
    abatementDateTime?: string;
    abatementAge?: {
        value?: number;
        unit?: string;
    };
    abatementPeriod?: {
        start?: string;
        end?: string;
    };
    abatementRange?: {
        low?: {
            value?: number;
        };
        high?: {
            value?: number;
        };
    };
    abatementString?: string;
    recordedDate?: string;
    recorder?: Reference;
    asserter?: Reference;
    stage?: Array<{
        summary?: CodeableConcept;
        assessment?: Reference[];
        type?: CodeableConcept;
    }>;
    evidence?: Array<{
        code?: CodeableConcept[];
        detail?: Reference[];
    }>;
    note?: Array<{
        text?: string;
        time?: string;
    }>;
}

// MedicationRequest Resource
export interface MedicationRequest {
    resourceType: "MedicationRequest";
    id?: string;
    identifier?: Identifier[];
    status: string;
    statusReason?: CodeableConcept;
    intent: string;
    category?: CodeableConcept[];
    priority?: string;
    doNotPerform?: boolean;
    medicationCodeableConcept?: CodeableConcept;
    medicationReference?: Reference;
    subject: Reference;
    encounter?: Reference;
    supportingInformation?: Reference[];
    authoredOn?: string;
    requester?: Reference;
    performer?: Reference;
    performerType?: CodeableConcept;
    recorder?: Reference;
    reasonCode?: CodeableConcept[];
    reasonReference?: Reference[];
    instantiatesCanonical?: string[];
    instantiatesUri?: string[];
    basedOn?: Reference[];
    groupIdentifier?: Identifier;
    courseOfTherapyType?: CodeableConcept;
    note?: Array<{
        text?: string;
        time?: string;
    }>;
    dosageInstruction?: Array<{
        sequence?: number;
        text?: string;
        additionalInstruction?: CodeableConcept[];
        patientInstruction?: string;
        timing?: {
            event?: string[];
            repeat?: {
                boundsDuration?: {
                    value?: number;
                    unit?: string;
                };
                boundsRange?: unknown;
                boundsPeriod?: {
                    start?: string;
                    end?: string;
                };
                count?: number;
                countMax?: number;
                duration?: number;
                durationMax?: number;
                durationUnit?: string;
                frequency?: number;
                frequencyMax?: number;
                period?: number;
                periodMax?: number;
                periodUnit?: string;
                dayOfWeek?: string[];
                timeOfDay?: string[];
                when?: string[];
                offset?: number;
            };
            code?: CodeableConcept;
        };
        asNeededBoolean?: boolean;
        asNeededCodeableConcept?: CodeableConcept;
        site?: CodeableConcept;
        route?: CodeableConcept;
        method?: CodeableConcept;
        doseAndRate?: Array<{
            type?: CodeableConcept;
            doseRange?: unknown;
            doseQuantity?: {
                value?: number;
                unit?: string;
            };
            rateRatio?: unknown;
            rateRange?: unknown;
            rateQuantity?: {
                value?: number;
                unit?: string;
            };
        }>;
        maxDosePerPeriod?: unknown;
        maxDosePerAdministration?: unknown;
        maxDosePerLifetime?: unknown;
    }>;
    dispenseRequest?: {
        initialFill?: {
            quantity?: {
                value?: number;
                unit?: string;
            };
            duration?: {
                value?: number;
                unit?: string;
            };
        };
        dispenseInterval?: {
            value?: number;
            unit?: string;
        };
        validityPeriod?: {
            start?: string;
            end?: string;
        };
        numberOfRepeatsAllowed?: number;
        quantity?: {
            value?: number;
            unit?: string;
        };
        expectedSupplyDuration?: {
            value?: number;
            unit?: string;
        };
        performer?: Reference;
    };
    substitution?: {
        allowed?: boolean;
        reason?: CodeableConcept;
    };
    priorPrescription?: Reference;
}

// DiagnosticReport Resource
export interface DiagnosticReport {
    resourceType: "DiagnosticReport";
    id?: string;
    identifier?: Identifier[];
    basedOn?: Reference[];
    status: string;
    category?: CodeableConcept[];
    code: CodeableConcept;
    subject?: Reference;
    encounter?: Reference;
    effectiveDateTime?: string;
    effectivePeriod?: {
        start?: string;
        end?: string;
    };
    issued?: string;
    performer?: Reference[];
    resultsInterpreter?: Reference[];
    specimen?: Reference[];
    result?: Reference[];
    imagingStudy?: Reference[];
    media?: Array<{
        comment?: string;
        link?: Reference;
    }>;
    conclusion?: string;
    conclusionCode?: CodeableConcept[];
    presentedForm?: Attachment[];
}

// DocumentReference Resource
export interface DocumentReference {
    resourceType: "DocumentReference";
    id?: string;
    masterIdentifier?: Identifier;
    identifier?: Identifier[];
    status: string;
    docStatus?: string;
    type?: CodeableConcept;
    category?: CodeableConcept[];
    subject?: Reference;
    date?: string;
    author?: Reference[];
    authenticator?: Reference;
    custodian?: Reference;
    relatesTo?: Array<{
        code?: string;
        target?: Reference;
    }>;
    description?: string;
    securityLabel?: CodeableConcept[];
    content: Array<{
        attachment: Attachment;
        format?: Coding;
    }>;
    context?: {
        encounter?: Reference[];
        event?: CodeableConcept[];
        period?: {
            start?: string;
            end?: string;
        };
        facilityType?: CodeableConcept;
        practiceSetting?: CodeableConcept;
        sourcePatientInfo?: Reference;
        related?: Reference[];
    };
}

// Encounter Resource
export interface Encounter {
    resourceType: "Encounter";
    id?: string;
    identifier?: Identifier[];
    status: string;
    statusHistory?: Array<{
        status?: string;
        period?: {
            start?: string;
            end?: string;
        };
    }>;
    class: Coding;
    classHistory?: Array<{
        class?: Coding;
        period?: {
            start?: string;
            end?: string;
        };
    }>;
    type?: CodeableConcept[];
    serviceType?: CodeableConcept;
    priority?: CodeableConcept;
    subject?: Reference;
    episodeOfCare?: Reference[];
    basedOn?: Reference[];
    participant?: Array<{
        type?: CodeableConcept[];
        period?: {
            start?: string;
            end?: string;
        };
        individual?: Reference;
    }>;
    appointment?: Reference[];
    period?: {
        start?: string;
        end?: string;
    };
    length?: {
        value?: number;
        unit?: string;
    };
    reasonCode?: CodeableConcept[];
    reasonReference?: Reference[];
    diagnosis?: Array<{
        condition?: Reference;
        use?: CodeableConcept;
        rank?: number;
    }>;
    account?: Reference[];
    hospitalization?: {
        preAdmissionIdentifier?: Identifier;
        origin?: Reference;
        admitSource?: CodeableConcept;
        reAdmission?: CodeableConcept;
        dietPreference?: CodeableConcept[];
        specialCourtesy?: CodeableConcept[];
        specialArrangement?: CodeableConcept[];
        destination?: Reference;
        dischargeDisposition?: CodeableConcept;
    };
    location?: Array<{
        location?: Reference;
        status?: string;
        physicalType?: CodeableConcept;
        period?: {
            start?: string;
            end?: string;
        };
    }>;
    serviceProvider?: Reference;
    partOf?: Reference;
}

// Bundle for multiple resources
export interface Bundle {
    resourceType: "Bundle";
    id?: string;
    meta?: {
        versionId?: string;
        lastUpdated?: string;
    };
    type: "document" | "message" | "transaction" | "transaction-response" | "batch" | "batch-response" | "history" | "searchset" | "collection";
    total?: number;
    link?: Array<{
        relation?: string;
        url?: string;
    }>;
    entry?: Array<{
        fullUrl?: string;
        resource?: Patient | Observation | Condition | MedicationRequest | DiagnosticReport | DocumentReference | Encounter;
        search?: {
            mode?: string;
            score?: number;
        };
        request?: {
            method?: string;
            url?: string;
        };
        response?: {
            status?: string;
            location?: string;
            etag?: string;
            lastModified?: string;
        };
    }>;
}

// OperationOutcome for errors
export interface OperationOutcome {
    resourceType: "OperationOutcome";
    issue: Array<{
        severity: "fatal" | "error" | "warning" | "information";
        code: string;
        details?: CodeableConcept;
        diagnostics?: string;
        location?: string[];
        expression?: string[];
    }>;
}
