/*
 * Copyright (C) 2018 Taktik SA
 *
 * This file is part of iCureBackend.
 *
 * iCureBackend is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 as published by
 * the Free Software Foundation.
 *
 * iCureBackend is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with iCureBackend.  If not, see <http://www.gnu.org/licenses/>.
 */


package org.taktik.icure.be.format.logic;

import java.io.IOException;
import java.io.OutputStream;
import java.time.LocalDateTime;
import java.util.List;

import org.taktik.icure.dto.result.ResultInfo;
import org.taktik.icure.entities.Contact;
import org.taktik.icure.entities.Document;
import org.taktik.icure.entities.HealthcareParty;
import org.taktik.icure.entities.Patient;

public interface ResultFormatLogic {
	boolean canHandle(Document doc, List<String> enckeys) throws IOException;
	List<ResultInfo> getInfos(Document doc, boolean full, String language, List<String> enckeys) throws IOException;
	Contact doImport(String language, Document doc, String hcpId, List<String> protocolIds, List<String> formIds, String planOfActionId, Contact ctc, List<String> enckeys) throws IOException;
	void doExport(HealthcareParty sender, HealthcareParty recipient, Patient patient, LocalDateTime date, String ref, String text, OutputStream output);
}
