import * as fhcApi from 'fhc-api/dist/fhcApi'
import * as iccApi from 'icc-api/dist/icc-api/iccApi'
import * as iccXApi from 'icc-api/dist/icc-x-api/index'
import {UtilsClass} from "icc-api/dist/icc-x-api/crypto/utils"

import moment from 'moment/src/moment'

onmessage = e => {
    if(e.data.action === "loadEhboxMessage"){
        const iccHost           = e.data.iccHost
        const iccHeaders        = JSON.parse(e.data.iccHeaders)

        const fhcHost           = e.data.fhcHost
        const fhcHeaders        = JSON.parse(e.data.fhcHeaders)

        const tokenId           = e.data.tokenId
        const keystoreId        = e.data.keystoreId
        const user              = e.data.user
        const ehpassword        = e.data.ehpassword
        const boxIds            = e.data.boxId
        const alternateKeystores= e.data.alternateKeystores
        const language          = e.data.language

        const ehboxApi          = new fhcApi.fhcEhboxcontrollerApi(fhcHost, fhcHeaders)

        const docApi            = new iccApi.iccDocumentApi(iccHost, iccHeaders)
        const msgApi            = new iccApi.iccMessageApi(iccHost, iccHeaders)
        const beResultApi       = new iccApi.iccBeresultimportApi(iccHost, iccHeaders)

        const iccHcpartyApi     = new iccApi.iccHcpartyApi(iccHost, iccHeaders)
        const iccPatientApi     = new iccApi.iccPatientApi(iccHost, iccHeaders)
        const iccContactApi		= new iccApi.iccContactApi(iccHost, iccHeaders)
        const iccCryptoXApi     = new iccXApi.IccCryptoXApi(iccHost, iccHeaders, iccHcpartyApi)

        const iccUtils          = new UtilsClass()

        //Avoid the hit to the local storage to load the key pair
        Object.keys(e.data.keyPairs).forEach( k => iccCryptoXApi.cacheKeyPair(e.data.keyPairs[k], k) )

        const iccDocumentXApi   = new iccXApi.IccDocumentXApi(iccHost, iccHeaders, iccCryptoXApi)
        const iccContactXApi	= new iccXApi.IccContactXApi(iccHost, iccHeaders,iccCryptoXApi)
        const iccFormXApi		= new iccXApi.IccFormXApi(iccHost, iccHeaders,iccCryptoXApi)
        const iccMessageXApi    = new iccXApi.IccMessageXApi(iccHost, iccHeaders, iccCryptoXApi)


        const textType = (uti, utis) =>{
			//return (uti && [uti] || []).concat(utis && utis.value || []).map(u => iccDocumentXApi.mimeType(u)).find(m => m === 'text/plain');
            // NOTE: mime type and extension from ehbox are not reliable, the ResultImport API can detect if it's the correct type
			return true
		}

        const removeMsgFromEhboxServer = (msg) => {
            if (msg) {
                const thisBox = msg.transportGuid.substring(0,msg.transportGuid.indexOf(':'))
                const delBox = thisBox === 'INBOX' ? 'BININBOX' : thisBox === 'SENTBOX' ? 'BINSENTBOX' : null
                const idOfMsg = msg.transportGuid.substring(msg.transportGuid.indexOf(':')+1)
                // console.log('remove from server',idOfMsg,thisBox,delBox)
                if (thisBox.transportGuid && !thisBox.transportGuid.startsWith("BIN")) { // if it was not in bin
                    // console.log('move to bin',idOfMsg,thisBox,delBox)
                    return ehboxApi.moveMessagesUsingPOST(keystoreId, tokenId, ehpassword, [idOfMsg], thisBox, delBox)
                        .then(()=>{
                            // console.log('move to bin done',idOfMsg,thisBox,delBox)
                        })
                        .catch(err => {
                            // console.log('ERROR: move to bin',idOfMsg,thisBox,delBox, err)
                        })
                } else { // if already in bin, del forever
                    // console.log('delete',idOfMsg,thisBox)
                    return ehboxApi.deleteMessagesUsingPOST(keystoreId, tokenId, ehpassword, [idOfMsg], thisBox)
                }
            }
        }

		const assignResult = (message,docInfo,document) => {
            console.log('assignResult',message,docInfo,document)
            // assign to patient/contact the result matching docInfo from all the results of the document
            // return {id: contactId, protocolId: protocolIdString} if success else null (in promise)
            if (textType(document.mainUti, document.otherUtis)) {
                //TODO Better search based on merge
                return iccPatientApi.findByNameBirthSsinAuto(user.healthcarePartyId, docInfo.lastName + " " + docInfo.firstName, null, null, 100, "asc").then(patients => {
                    if (patients && patients.rows[0]) {
                        let thisPat = patients.rows[0]
                        if (patients.rows.length > 0) {
                            // console.log('multiple match')
                            patients.rows.map(pat=>{
                                if (pat.lastName.toUpperCase() === docInfo.lastName.toUpperCase() &&
                                    pat.firstName.toUpperCase() === docInfo.firstName.toUpperCase() &&
                                    pat.dateOfBirth === docInfo.dateOfBirth) {
                                    // console.log('occurence found',pat)
                                    thisPat = pat
                                }
                            })
                        }
                        // console.log('pat > ',thisPat)
                        return iccContactXApi.newInstance(user, thisPat, {
                            groupId: message.id,
                            created: new Date().getTime(),
                            modified: new Date().getTime(),
                            author: user.id,
                            responsible: user.healthcarePartyId,
                            openingDate: moment().format('YYYYMMDDHHmmss') || '',
                            closingDate: moment().format('YYYYMMDDHHmmss') || '',
                            encounterType: {
                                type: docInfo.codes.type,
                                version: docInfo.codes.version,
                                code: docInfo.codes.code
                            },
                            descr: docInfo.labo,
                            tags:[{type:'CD-TRANSACTION',code:'labresult'}],
                            subContacts: []
                        }).then(c => {
                            c.services.push({
                                id: iccCryptoXApi.randomUuid(),
                                label: 'labResult',
                                valueDate: parseInt(moment().format('YYYYMMDDHHmmss')),
                                content: _.fromPairs([[language, {stringValue:docInfo.labo}]]),
                                tags:[{type:'CD-TRANSACTION',code:'labresult'}]
                            })
                            console.log('c services',c.services)
                            return iccContactXApi.createContactWithUser(user, c)
                        }).then(c => {
                            console.log('createContact',c)
                            return iccFormXApi.newInstance(user, thisPat, {
                                contactId: c.id,
                                descr: "Lab " + new Date().getTime(),
                            }).then(f => {
                                return iccFormXApi.createForm(f).then(f =>
                                    iccCryptoXApi
                                        .extractKeysFromDelegationsForHcpHierarchy(
                                            user.healthcarePartyId,
                                            document.id,
                                            _.size(document.encryptionKeys) ? document.encryptionKeys : document.delegations
                                        )
                                        .then(({extractedKeys: enckeys}) => beResultApi.doImport(document.id, user.healthcarePartyId, language, docInfo.protocol, f.id, null, enckeys.join(','), c))
                                )
                            })
                        }).then(c => {
                            console.log("did import ", c, docInfo);
                            return {id: c.id, protocolId: docInfo.protocol}
                        }).catch(err => {
                            console.log(err)
                        })
                    } else {
                        console.log("pat not found:", docInfo.lastName + " " + docInfo.firstName)
                        return Promise.resolve()
                    }
                })
            } else {
                // console.log("message not text type")
                return Promise.resolve()
            }
        } // assignResult end

        const createDbMessageWithAppendicesAndTryToAssign =  (message,boxId) => {
            return ehboxApi.getFullMessageUsingGET(keystoreId, tokenId, ehpassword, boxId, message.id)
                .then(fullMessage => msgApi.findMessagesByTransportGuid(boxId+":"+message.id, null, null, 1).then(existingMess => [fullMessage, existingMess]))
                .then(([fullMessage, existingMess]) => {
                    if (existingMess.rows.length > 0) {
                        //console.log("Message already known in DB",existingMess.rows)
                        const existingMessage = existingMess.rows[0]
                        // remove messages older than 7d
                        if(existingMessage.created !== null && existingMessage.created < (Date.now() - (7 * 24 * 3600000))) {
                            return removeMsgFromEhboxServer(existingMessage)
                        }
                        return Promise.resolve()
                    } else {
                        console.log('fullMessage',fullMessage)
                        console.log('boxId',boxId)
                        registerNewMessage(fullMessage, boxId)
                            .then(([createdMessage, annexDocs]) => {
                                return tryToAssignAppendices(createdMessage, fullMessage, annexDocs, boxId)
                            })
                    }
                })
        }

        const tryToAssignAppendices = (createdMessage, fullMessage, annexDocs, boxId) => {
            if (boxId === "INBOX" && annexDocs) { // only import annexes in inbox
                let results = annexDocs.filter(doc => doc.documentLocation !== "body").map(doc => {
                    return tryToAssignAppendix(fullMessage, doc)
                }).flat()

                return Promise.all(results)
                    .then (reslist => {
                        let assignedMap = {}
                        let unassignedList = []
                        reslist.flat().forEach(result => {
                            if (result.assigned) {
                                assignedMap[result.contactId] = result.protocolId
                            } else {
                                unassignedList.push(result.protocolId)
                            }
                        })
                        createdMessage.unassignedResults = unassignedList
                        createdMessage.assignedResults = assignedMap

                        return msgApi.modifyMessage(createdMessage)
                    })
            } else {
                return Promise.resolve()
            }
        }

        const tryToAssignAppendix = (fullMessage, createdDocument) => {
            // console.log('tryToAssignAppendix',fullMessage,createdDocument)
            return iccCryptoXApi
                .extractKeysFromDelegationsForHcpHierarchy(
                    user.healthcarePartyId,
                    createdDocument.id,
                    _.size(createdDocument.encryptionKeys) ? createdDocument.encryptionKeys : createdDocument.delegations
                )
                .then(({extractedKeys: enckeys}) => beResultApi.getInfos(createdDocument.id, false, null, enckeys.join(',')))
                .then(docInfos => {
                    console.log('tryToAssignAppendix',fullMessage,createdDocument,docInfos)
                    return Promise.all(
                        docInfos.map(docInfo => {
                           return assignResult(fullMessage, docInfo, createdDocument).then(result => {
                               if(result != null) {
                                   console.log('result',result)
                                   return {assigned: true, protocolId: result.protocolId, contactId: result.id}
                               } else {
                                   return {assigned: false, protocolId: docInfo.protocol, contactId: null}
                               }
                           })
                        } )
                    )
                })
                .catch(err => {
                    return []
                })
        }

        const registerNewMessage = (fullMessage, boxId) => {
            // console.log('registerNewMessage',fullMessage,boxId)
            let createdDate = moment(fullMessage.publicationDateTime, "YYYYMMDD").valueOf()
            let receivedDate = new Date().getTime()

            let tempStatus = fullMessage.status ? fullMessage.status : 0<<0 | 1<<1
            if (!fullMessage.status ) {
                tempStatus = fullMessage && fullMessage.important ? tempStatus|1<<2 : tempStatus
                tempStatus = fullMessage && fullMessage.encrypted ? tempStatus|1<<3 : tempStatus
                tempStatus = fullMessage && fullMessage.annex.length ? tempStatus|1<<4 : tempStatus
            }

            (fullMessage.destinations).forEach(dest=>{
                //
            })

            let newMessage = {
                created: createdDate,
                fromAddress: getFromAddress(fullMessage.sender),
                subject: (fullMessage.document && fullMessage.document.title) || fullMessage.errorCode + " " + fullMessage.title,
                metas: fullMessage.customMetas,
                toAddresses: [boxId],
                transportGuid: boxId + ":" + fullMessage.id,
                fromHealthcarePartyId: fullMessage.fromHealthcarePartyId ? fullMessage.fromHealthcarePartyId : fullMessage.sender.id,
                received: receivedDate,
                status: tempStatus
            }

            return iccMessageXApi.newInstance(_.omit(user, ['autoDelegations']), newMessage)
                .then(messageInstance => msgApi.createMessage(messageInstance))
                .then(createdMessage => {
                    // register body and annexes as documents
                    const annexPromises = (fullMessage.document ? [fullMessage.document] : []).concat(fullMessage.annex || []).map(a => {
                        if (a == null) {
                            console.log("annex is null")
                            return null
                        } else {
                            return registerNewDocument(a, createdMessage, fullMessage)
                        }
                    }).filter(a => a != null)

                    return Promise.all(annexPromises)
                        .then(annexDocs => {
                            return [createdMessage, annexDocs]
                        }).catch(e => {
                            console.log("Message annexes creation failed for ", e)
                            iccMessageXApi.message().deleteMessages(createdMessage.id).then(() => { throw e })
                        })
                })
        }

        const registerNewDocument = (document, createdMessage, fullMessage) => {
            let a = document
            // console.log('registerNewDocument',a)
            return iccDocumentXApi.newInstance(user, createdMessage, {
                documentLocation: (fullMessage.document && a.content === fullMessage.document.content) ? 'body' : 'annex',
                documentType: 'result', //Todo identify message and set type accordingly
                mainUti: iccDocumentXApi.uti(a.mimeType, a.filename && a.filename.replace(/.+\.(.+)/, '$1')),
                name: a.filename
            })
                .then(d => docApi.createDocument(d))
                .then(createdDocument => {
                    //console.log('createdDocument',createdDocument)
                    let byteContent = iccUtils.base64toArrayBuffer(a.content)
                    return [createdDocument, byteContent]
                })
                .then(([createdDocument, byteContent]) => {
                    return iccCryptoXApi
                        .extractKeysFromDelegationsForHcpHierarchy(
                            user.healthcarePartyId,
                            createdDocument.id,
                            _.size(createdDocument.encryptionKeys) ? createdDocument.encryptionKeys : createdDocument.delegations
                        )
                        .then(({extractedKeys: enckeys}) => docApi.setAttachment(createdDocument.id, enckeys.join(','), byteContent))
                        .then(() => createdDocument)
                })

        }


        boxIds && boxIds.forEach(boxId =>{
            ehboxApi.loadMessagesUsingPOST(keystoreId, tokenId, ehpassword, boxId, 100, alternateKeystores)
                .then(messages => {
                    let p = Promise.resolve([])
                    messages.forEach(m => {
                        p = p.then(() => {
                            return createDbMessageWithAppendicesAndTryToAssign(m, boxId)
                                .catch(e => {console.log("Error processing message "+m.id,e); return Promise.resolve()})
                        })
                    })
                    return p
                })
                .catch(err => console.log("Error while fetching messages: " + err))
        })
    }
};

function getFromAddress(sender){
    if (!sender) { return "" }
    return (sender.lastName ? sender.lastName : "") +
        (sender.firstName ? ' '+sender.firstName : "") +
        (sender.organizationName ? ' '+sender.organizationName : "") +
        (' ' + sender.identifierType.type + ':' + sender.id)

}
