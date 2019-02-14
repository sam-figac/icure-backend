/*
 * Copyright (C) 2018 Taktik SA
 *
 * This file is part of iCureBackend.
 *
 * iCureBackend is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * iCureBackend is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with iCureBackend.  If not, see <http://www.gnu.org/licenses/>.
 */

package org.taktik.icure.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.taktik.icure.be.mikrono.impl.MikronoLogicImpl
import org.taktik.icure.properties.MikronoProperties

@Configuration
class MikronoConfig {
    @Bean fun mikronoLogic(mikronoProperties: MikronoProperties) = MikronoLogicImpl(mikronoProperties.applicationtoken, mikronoProperties.server, mikronoProperties.superuser, mikronoProperties.supertoken)
}
