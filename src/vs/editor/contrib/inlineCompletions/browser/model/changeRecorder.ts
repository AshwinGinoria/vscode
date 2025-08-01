/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { autorunWithStore } from '../../../../../base/common/observable.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ICodeEditor } from '../../../../browser/editorBrowser.js';
import { CodeEditorWidget } from '../../../../browser/widget/codeEditor/codeEditorWidget.js';
import { IDocumentEventDataSetChangeReason, IRecordableEditorLogEntry, StructuredLogger } from '../structuredLogger.js';

export interface ITextModelChangeRecorderMetadata {
	source?: string;
	extensionId?: string;
	nes?: boolean;
	type?: 'word' | 'line';
}

export class TextModelChangeRecorder extends Disposable {
	private readonly _structuredLogger;

	constructor(
		private readonly _editor: ICodeEditor,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
	) {
		super();
		this._structuredLogger = this._register(this._instantiationService.createInstance(StructuredLogger.cast<IRecordableEditorLogEntry & IDocumentEventDataSetChangeReason>(),
			'editor.inlineSuggest.logChangeReason.commandId'
		));
		this._register(autorunWithStore((reader, store) => {
			if (!(this._editor instanceof CodeEditorWidget)) { return; }
			if (!this._structuredLogger.isEnabled.read(reader)) { return; }

			store.add(this._editor.onDidChangeModelContent(e => {
				const tm = this._editor.getModel();
				if (!tm) { return; }

				const reason = e.detailedReasons[0];

				const data: IRecordableEditorLogEntry & IDocumentEventDataSetChangeReason = {
					...reason.metadata,
					sourceId: 'TextModel.setChangeReason',
					source: reason.metadata.source,
					time: Date.now(),
					modelUri: tm.uri,
					modelVersion: tm.getVersionId(),
				};
				setTimeout(() => {
					// To ensure that this reaches the extension host after the content change event.
					// (Without the setTimeout, I observed this command being called before the content change event arrived)
					this._structuredLogger.log(data);
				}, 0);
			}));
		}));
	}
}
