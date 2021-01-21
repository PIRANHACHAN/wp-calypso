/**
 * External dependencies
 */

import debugFactory from 'debug';
import { get, isEmpty } from 'lodash';

/**
 * Internal dependencies
 */
import getUserSettings from 'calypso/state/selectors/get-user-settings';
import {
	USER_SETTINGS_REQUEST,
	USER_SETTINGS_SAVE,
	USER_SETTINGS_SAVE_SUCCCESS,
	USER_SETTINGS_SAVE_FAILURE,
	USER_SETTINGS_UNSAVED_CLEAR,
	USER_SETTINGS_UNSAVED_SET,
	USER_SETTINGS_UNSAVED_REMOVE,
} from 'calypso/state/action-types';

import 'calypso/state/data-layer/wpcom/me/settings';

const debug = debugFactory( 'calypso:user:settings' );

/**
 * Fetch user settings from WordPress.com API and store them in UserSettings instance
 *
 * @returns {object} Action object
 */
export const fetchUserSettings = () => ( {
	type: USER_SETTINGS_REQUEST,
} );

/**
 * Post settings to WordPress.com API at /me/settings endpoint
 *
 * @param {object} settingsOverride - default settings object
 * @returns {object} Action object
 */
export const saveUserSettings = ( settingsOverride ) => ( {
	type: USER_SETTINGS_SAVE,
	settingsOverride,
} );

/**
 * Returns an action object signalling the settings have been received from server.
 *
 * @param  {object} settingValues Setting values (the subset of keys to be updated)
 * @returns {object}               Action object
 */
export const saveUserSettingsSuccess = ( settingValues ) => ( {
	type: USER_SETTINGS_SAVE_SUCCCESS,
	settingValues,
} );

export const saveUserSettingsFailure = ( settingsOverride, error ) => ( {
	type: USER_SETTINGS_SAVE_FAILURE,
	settingsOverride,
	error,
} );

export const cancelPendingEmailChange = () => ( {
	type: USER_SETTINGS_SAVE,
	settingsOverride: { user_email_change_pending: false },
} );

export const clearUnsavedUserSettings = ( settingNames = null ) => ( {
	type: USER_SETTINGS_UNSAVED_CLEAR,
	settingNames,
} );

export const setUnsavedUserSetting = ( settingName, value ) => ( {
	type: USER_SETTINGS_UNSAVED_SET,
	settingName,
	value,
} );

export const removeUnsavedUserSetting = ( settingName ) => ( {
	type: USER_SETTINGS_UNSAVED_REMOVE,
	settingName,
} );

/**
 * Checks if an incoming change to settings.language is a change to the existing settings
 * Currently the assumption is that if a settings.locale_variant slug exists, then that is the current language
 *
 * @param  {string}  languageSettingValue the newly-set language slug string.
 * @param  {object}  settings user settings object.
 * @returns {boolean} if the language setting has been changed.
 */
function hasLanguageChanged( languageSettingValue, settings = {} ) {
	if ( ! languageSettingValue ) {
		return false;
	}
	// if there is a saved variant we know that the user is changing back to the root language === setting hasn't changed
	// but if settings.locale_variant is not empty then we assume the user is trying to switch back to the root
	return (
		( languageSettingValue === settings.language && isEmpty( settings.locale_variant ) ) ||
		//if the incoming language code is the variant itself === setting hasn't changed
		languageSettingValue === settings.locale_variant
	);
}

/**
 * Handles the storage and removal of changed setting that are pending
 * being saved to the WPCOM API.
 *
 * @param  {string} settingName - setting name
 * @param  {*} value - setting value
 * @returns {Function} Action thunk that returns updating successful response
 */
export function setUserSetting( settingName, value ) {
	return ( dispatch, getState ) => {
		const settings = getUserSettings( getState() );
		const settingKey = Array.isArray( settingName ) ? settingName : settingName.split( '.' );
		const originalSetting = get( settings, settingKey );

		/*
		 * Exclude `colorScheme` from this condition.
		 * This is a workaround that allows us to use `setUserSetting()` without an
		 * existing value. Without this workaround the save button wouldn't become active.
		 * @TODO: the API should provide a default value, which would make this line obsolete
		 */
		if ( originalSetting === undefined && settingName !== 'calypso_preferences.colorScheme' ) {
			debug( settingName + ' does not exist in user-settings data module.' );
			return false;
		}

		/*
		 * If the two match, we don't consider the setting "changed".
		 * user_login is a special case since the logic for validating and saving a username
		 * is more complicated.
		 */
		if (
			( originalSetting === value && 'user_login' !== settingKey && 'language' !== settingKey ) ||
			( 'language' === settingName && hasLanguageChanged( value, settings ) )
		) {
			debug( 'Removing ' + settingKey + ' from changed settings.' );
			dispatch( removeUnsavedUserSetting( settingKey ) );
		} else {
			dispatch( setUnsavedUserSetting( settingKey, value ) );
		}

		return true;
	};
}
