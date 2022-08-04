import React from 'react'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import { faList, faTh, faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

interface IToolbarPropsHeader {
	onFilterChange?: (newFilter: string | undefined) => void
	noSegments?: boolean
	searchFilter: string | undefined
}

export function AdLibPanelToolbar(props: IToolbarPropsHeader) {
	const { t } = useTranslation()

	function searchInputChanged(e?: React.ChangeEvent<HTMLInputElement>) {
		const newValue = e?.target.value || undefined
		props.onFilterChange && typeof props.onFilterChange === 'function' && props.onFilterChange(newValue)
	}

	function searchInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === 'Escape' || e.key === 'Enter') {
			document.querySelector('button')?.focus()
		} else if (e.key.match(/^F\d+$/)) {
			e.preventDefault()
		}
	}

	function clearSearchInput() {
		searchInputChanged()
	}

	return (
		<div
			className={classNames('adlib-panel__list-view__toolbar', {
				'adlib-panel__list-view__toolbar--no-segments': props.noSegments,
			})}
		>
			<div className="adlib-panel__list-view__toolbar__filter">
				<input
					className="adlib-panel__list-view__toolbar__filter__input"
					type="text"
					placeholder={t('Search...')}
					onChange={searchInputChanged}
					onKeyDown={searchInputKeyDown}
					value={props.searchFilter || ''}
				/>
				{props.searchFilter && (
					<div className="adlib-panel__list-view__toolbar__filter__clear" onClick={clearSearchInput}>
						<FontAwesomeIcon icon={faTimes} />
					</div>
				)}
			</div>
			<div className="adlib-panel__list-view__toolbar__buttons" style={{ display: 'none' }}>
				<button className="action-btn">
					<FontAwesomeIcon icon={faList} />
				</button>
				<button className="action-btn">
					<FontAwesomeIcon icon={faTh} />
				</button>
			</div>
		</div>
	)
}
