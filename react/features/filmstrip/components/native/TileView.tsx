import React, { PureComponent } from 'react';
import {
    FlatList,
    GestureResponderEvent,
    TouchableWithoutFeedback,
    View,
    ViewToken
} from 'react-native';
import { connect } from 'react-redux';

import { IReduxState, IStore } from '../../../app/types';
import { getLocalParticipant, getParticipantCountWithFake } from '../../../base/participants/functions';
import { ILocalParticipant } from '../../../base/participants/types';
import { getHideSelfView } from '../../../base/settings/functions.any';
import { setVisibleRemoteParticipants } from '../../actions.web';

import Thumbnail from './Thumbnail';
import styles from './styles';

/**
 * The type of the React {@link Component} props of {@link TileView}.
 */
interface IProps {

    /**
     * Application's aspect ratio.
     */
    _aspectRatio: Symbol;

    /**
     * The number of columns.
     */
    _columns: number;

    /**
     * Whether or not to hide the self view.
     */
    _disableSelfView: boolean;

    /**
     * Application's viewport height.
     */
    _height: number;

    /**
     * The local participant.
     */
    _localParticipant?: ILocalParticipant;

    /**
     * The number of participants in the conference.
     */
    _participantCount: number;

    /**
     * An array with the IDs of the remote participants in the conference.
     */
    _remoteParticipants: Array<string>;

    /**
     * The thumbnail height.
     */
    _thumbnailHeight?: number;

    /**
     * Safe area top inset.
     */
    _safeAreaTop: number;

    /**
     * Safe area bottom inset.
     */
    _safeAreaBottom: number;

    /**
     * Application's viewport height.
     */
    _width: number;

    /**
     * Invoked to update the receiver video quality.
     */
    dispatch: IStore['dispatch'];

    /**
     * Callback to invoke when tile view is tapped.
     */
    onClick: (e?: GestureResponderEvent) => void;
}

/**
 * An empty array. The purpose of the constant is to use the same reference every time we need an empty array.
 * This will prevent unnecessary re-renders.
 */
const EMPTY_ARRAY: any[] = [];
const GRID_PADDING_TOP = 12;
const GRID_PADDING_BOTTOM = 16;

/**
 * Implements a React {@link PureComponent} which displays thumbnails in a two
 * dimensional grid.
 *
 * @augments PureComponent
 */
class TileView extends PureComponent<IProps> {
    /**
     * Cached pages for pagination.
     */
    _pages: Array<Array<string>>;

    /**
     * The FlatList's viewabilityConfig.
     */
    _viewabilityConfig: Object;

    /**
     * Creates new TileView component.
     *
     * @param {IProps} props - The props of the component.
     */
    constructor(props: IProps) {
        super(props);

        this._keyExtractor = this._keyExtractor.bind(this);
        this._renderThumbnail = this._renderThumbnail.bind(this);
        this._renderPage = this._renderPage.bind(this);
        this._onPageViewableItemsChanged = this._onPageViewableItemsChanged.bind(this);

        this._pages = [];
        this._viewabilityConfig = {
            itemVisiblePercentThreshold: 60,
            minimumViewTime: 300
        };
    }

    /**
     * Returns a key for a passed item of the list.
     *
     * @param {string} item - The user ID.
     * @returns {string} - The user ID.
     */
    _keyExtractor(item: string) {
        return item;
    }

    override componentDidMount() {
        this._updateVisibleParticipantsForPage(0);
    }

    override componentDidUpdate(prevProps: IProps) {
        if (prevProps._remoteParticipants.length !== this.props._remoteParticipants.length
            || prevProps._disableSelfView !== this.props._disableSelfView) {
            this._updateVisibleParticipantsForPage(0);
        }
    }

    /**
     * Implements React's {@link Component#render()}.
     *
     * @inheritdoc
     * @returns {ReactElement}
     */
    render() {
        const { _height, _width, onClick } = this.props;
        const participants = this._getSortedParticipants();
        const pages = this._chunkParticipants(participants, 6);

        this._pages = pages;

        if (participants.length > 6) {
            return (
                <TouchableWithoutFeedback onPress = { onClick }>
                    <View style = { styles.flatListContainer }>
                        <FlatList
                            data = { pages }
                            horizontal = { true }
                            keyExtractor = { (_, index) => `page-${index}` }
                            pagingEnabled = { true }
                            renderItem = { this._renderPage }
                            showsHorizontalScrollIndicator = { false }
                            showsVerticalScrollIndicator = { false }
                            viewabilityConfig = { this._viewabilityConfig }
                            onViewableItemsChanged = { this._onPageViewableItemsChanged } />
                    </View>
                </TouchableWithoutFeedback>
            );
        }

        return (
            <TouchableWithoutFeedback onPress = { onClick }>
                <View style = { styles.flatListContainer }>
                    { this._renderGrid(participants) }
                </View>
            </TouchableWithoutFeedback>
        );
    }

    /**
     * Returns all participants with the local participant at the end.
     *
     * @private
     * @returns {Participant[]}
     */
    _getSortedParticipants() {
        const { _localParticipant, _remoteParticipants, _disableSelfView } = this.props;

        if (!_localParticipant) {
            return EMPTY_ARRAY;
        }

        if (_disableSelfView) {
            return _remoteParticipants;
        }

        return [ _localParticipant?.id, ..._remoteParticipants ].reverse();
    }

    /**
     * Creates React Element to display each participant in a thumbnail.
     *
     * @private
     * @returns {ReactElement}
     */
    _renderThumbnail({ item, height, width }: { item: string; height?: number; width?: number; }) {

        return (
            <Thumbnail
                key = { item }
                height = { height }
                participantID = { item }
                renderDisplayName = { true }
                showAudioIndicator = { true }
                tileView = { true }
                width = { width } />)
        ;
    }

    _renderPage({ item }: { item: Array<string>; }) {
        return this._renderGrid(item);
    }

    _renderGrid(participants: Array<string>) {
        const { _height, _width, _safeAreaBottom } = this.props;
        const { columns, rows, tileHeight, tileWidth, tileMargin } = this._getGridDimensions(participants.length);

        return (
            <View
                style = { [
                    styles.tileGridContainer,
                    {
                        height: _height,
                        paddingTop: GRID_PADDING_TOP,
                        paddingBottom: GRID_PADDING_BOTTOM + _safeAreaBottom,
                        width: _width,
                    }
                ] }>
                { Array.from({ length: rows }).map((_, rowIndex) => {
                    const start = rowIndex * columns;
                    const rowItems = participants.slice(start, start + columns);
                    const isLastRow = rowIndex === rows - 1;
                    const hasShortRow = isLastRow && rowItems.length < columns;
                    const justifyContent = 'flex-start';
                    const rowTileWidth = hasShortRow
                        ? (_width - (rowItems.length * tileMargin * 2)) / rowItems.length
                        : tileWidth;

                    return (
                        <View
                            // eslint-disable-next-line react/no-array-index-key
                            key = { `tile-row-${rowIndex}` }
                            style = { [
                                styles.tileRow,
                                {
                                    height: tileHeight + (tileMargin * 2),
                                    justifyContent
                                }
                            ] }>
                            { rowItems.map(item => this._renderThumbnail({
                                item,
                                height: tileHeight,
                                width: rowTileWidth
                            })) }
                        </View>
                    );
                }) }
            </View>
        );
    }

    _getGridDimensions(count: number) {
        const { _height, _width, _safeAreaTop, _safeAreaBottom } = this.props;
        const availableHeight = _height - _safeAreaTop - _safeAreaBottom - GRID_PADDING_TOP - GRID_PADDING_BOTTOM;
        const availableWidth = _width;
        const tileMargin = 2;

        if (count <= 0) {
            return {
                columns: 1,
                rows: 1,
                tileHeight: availableHeight,
                tileWidth: availableWidth,
                tileMargin
            };
        }

        if (count === 2) {
            const columns = 1;
            const rows = 2;

            return {
                columns,
                rows,
                tileHeight: (availableHeight - (rows * tileMargin * 2)) / rows,
                tileWidth: (availableWidth - (columns * tileMargin * 2)) / columns,
                tileMargin
            };
        }

        const maxColumns = availableWidth > availableHeight ? 3 : 2;
        const columns = Math.min(maxColumns, Math.ceil(Math.sqrt(count)));
        const rows = Math.ceil(count / columns);

        return {
            columns,
            rows,
            tileHeight: (availableHeight - (rows * tileMargin * 2)) / rows,
            tileWidth: (availableWidth - (columns * tileMargin * 2)) / columns,
            tileMargin
        };
    }

    _chunkParticipants(participants: Array<string>, pageSize: number) {
        const pages: Array<Array<string>> = [];

        for (let i = 0; i < participants.length; i += pageSize) {
            pages.push(participants.slice(i, i + pageSize));
        }

        return pages;
    }

    _onPageViewableItemsChanged({ viewableItems = [] }: { viewableItems: ViewToken[]; }) {
        const pageIndex = viewableItems[0]?.index ?? 0;

        this._updateVisibleParticipantsForPage(pageIndex);
    }

    _updateVisibleParticipantsForPage(pageIndex: number) {
        const { _remoteParticipants, dispatch } = this.props;
        const page = this._pages[pageIndex] || [];
        const remoteIds = page.filter(id => _remoteParticipants.includes(id));

        if (remoteIds.length === 0) {
            return;
        }

        const indices = remoteIds
            .map(id => _remoteParticipants.indexOf(id))
            .filter(index => index >= 0);

        if (indices.length === 0) {
            return;
        }

        const start = Math.min(...indices);
        const end = Math.max(...indices);

        dispatch(setVisibleRemoteParticipants(start, end));
    }
}

/**
 * Maps (parts of) the redux state to the associated {@code TileView}'s props.
 *
 * @param {Object} state - The redux state.
 * @param {Object} ownProps - Component props.
 * @private
 * @returns {IProps}
 */
function _mapStateToProps(state: IReduxState, ownProps: any) {
    const responsiveUi = state['features/base/responsive-ui'];
    const { safeAreaInsets } = responsiveUi;
    const { remoteParticipants, tileViewDimensions } = state['features/filmstrip'];
    const disableSelfView = getHideSelfView(state);
    const { height } = tileViewDimensions?.thumbnailSize ?? {};
    const { columns } = tileViewDimensions ?? {};

    return {
        _aspectRatio: responsiveUi.aspectRatio,
        _columns: columns ?? 1,
        _disableSelfView: disableSelfView,
        _height: responsiveUi.clientHeight,
        _localParticipant: getLocalParticipant(state),
        _participantCount: getParticipantCountWithFake(state),
        _remoteParticipants: remoteParticipants,
        _safeAreaBottom: safeAreaInsets?.bottom ?? 0,
        _safeAreaTop: safeAreaInsets?.top ?? 0,
        _thumbnailHeight: height,
        _width: responsiveUi.clientWidth
    };
}

export default connect(_mapStateToProps)(TileView);
